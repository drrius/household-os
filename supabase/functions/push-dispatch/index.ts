import { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

import {
  DRAIN_COUNT_KEY,
  drainRow,
  loadPushConfig,
  type DrainCounts,
  type OutboxRow,
} from "../_shared/push-dispatch-delivery.ts";
import { authenticatePushDispatch } from "../_shared/push-dispatch-auth.ts";

export type { PushDeliveryResult } from "../_shared/push-dispatch-delivery.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("method not allowed", { status: 405 });
  }

  const authentication = authenticatePushDispatch(request, (name) =>
    Deno.env.get(name),
  );
  if (authentication === null) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  if (!supabaseUrl) {
    return Response.json({ error: "missing supabase url" }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, authentication.credential, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const counts: DrainCounts = {
    sent: 0,
    skipped: 0,
    retry: 0,
    deferred: 0,
    failed: 0,
  };
  const config = loadPushConfig();
  const processedIds: string[] = [];
  for (let processed = 0; processed < 50; processed += 1) {
    const { data: rows, error } = await supabase
      .rpc("claim_push_outbox", {
        p_limit: 1,
        p_lease_seconds: 120,
        p_excluded_ids: processedIds,
      })
      .overrideTypes<OutboxRow[], { merge: false }>();
    if (error) {
      return Response.json(
        { error: error.message, ...counts },
        { status: 500 },
      );
    }
    const row = rows.at(0);
    if (row === undefined) {
      break;
    }
    processedIds.push(row.id);
    const result = await drainRow(supabase, row, config);
    counts[DRAIN_COUNT_KEY[result.kind]] += 1;
  }

  return Response.json(counts);
});
