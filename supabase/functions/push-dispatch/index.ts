import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

import {
  DRAIN_COUNT_KEY,
  drainRow,
  loadPushConfig,
  type DrainCounts,
  type OutboxRow,
} from "../_shared/push-dispatch-delivery.ts";

export type { PushDeliveryResult } from "../_shared/push-dispatch-delivery.ts";

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
    .select(
      `
        id,
        recipient_member_id,
        inbox_notification_id,
        household_id,
        attempt_count,
        inbox:inbox_notifications!inner (
          id,
          kind,
          activity_kind,
          entity_type
        )
      `,
    )
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(50)
    .overrideTypes<OutboxRow[], { merge: false }>();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  const counts: DrainCounts = { sent: 0, skipped: 0, failed: 0 };
  const config = loadPushConfig();
  for (const row of rows) {
    const result = await drainRow(supabase, row, config);
    counts[DRAIN_COUNT_KEY[result.kind]] += 1;
  }

  return Response.json(counts);
});
