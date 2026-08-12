/**
 * Free-tier Edge Function: drain pending push_outbox rows.
 * VAPID keys stay in Edge secrets. Missing secrets leave inbox intact.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

type OutboxRow = {
  id: string;
  recipient_member_id: string;
};

type DrainCounts = { skipped: number; failed: number };

async function markOutbox(
  supabase: ReturnType<typeof createClient>,
  id: string,
  status: "skipped_no_subscription" | "failed",
  lastError: string | null,
): Promise<void> {
  await supabase
    .from("push_outbox")
    .update({
      status,
      last_error: lastError,
      attempt_count: status === "failed" ? 1 : 0,
      processed_at: new Date().toISOString(),
    })
    .eq("id", id);
}

async function drainRow(
  supabase: ReturnType<typeof createClient>,
  row: OutboxRow,
  counts: DrainCounts,
): Promise<void> {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id")
    .eq("member_id", row.recipient_member_id)
    .is("disabled_at", null);

  if (error) {
    counts.failed += 1;
    await markOutbox(supabase, row.id, "failed", error.message);
    return;
  }

  if (!subscriptions || subscriptions.length === 0) {
    counts.skipped += 1;
    await markOutbox(supabase, row.id, "skipped_no_subscription", null);
    return;
  }

  if (!Deno.env.get("VAPID_PUBLIC_KEY") || !Deno.env.get("VAPID_PRIVATE_KEY")) {
    counts.skipped += 1;
    await markOutbox(
      supabase,
      row.id,
      "skipped_no_subscription",
      "vapid secrets not configured",
    );
    return;
  }

  counts.failed += 1;
  await markOutbox(
    supabase,
    row.id,
    "failed",
    "web push transport not configured in this runtime",
  );
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json(
      { error: "missing supabase service credentials" },
      { status: 500 },
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: rows, error } = await supabase
    .from("push_outbox")
    .select("id, recipient_member_id")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const counts: DrainCounts = { skipped: 0, failed: 0 };
  for (const row of (rows ?? []) as OutboxRow[]) {
    await drainRow(supabase, row, counts);
  }

  return Response.json(counts);
});
