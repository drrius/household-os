import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  pushEndpointSchema,
  pushTestRequestSchema,
  pushTestStatusSchema,
} from "@/lib/notifications/push-status-contract";

export class PushStatusError extends Error {}

export async function readPushRegistration(endpoint: string) {
  const member = await requireMemberContext();
  const parsed = pushEndpointSchema.parse(endpoint);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, disabled_at")
    .eq("household_id", member.householdId)
    .eq("member_id", member.userId)
    .eq("endpoint", parsed)
    .maybeSingle();
  if (error) throw new Error("Could not check this device. Try again.");
  return { registered: data !== null && data.disabled_at === null };
}

export async function devicePushTest(
  command: "enqueue_self_device_push_test" | "read_self_device_push_test",
  input: { endpoint: string; requestId: string },
) {
  await requireMemberContext();
  const validation = pushTestRequestSchema.safeParse(input);
  if (!validation.success)
    throw new PushStatusError("Check this device again before testing.");
  const parsed = validation.data;
  const supabase = await createClient();
  // New RPCs are typed here until integration regenerates the shared schema.
  const { data, error } = await supabase.rpc(
    command as never,
    {
      p_endpoint: parsed.endpoint,
      p_request_id: parsed.requestId,
    } as never,
  );
  if (error) {
    const expected = error.code === "22023" || error.code === "42501";
    throw new PushStatusError(
      expected ? error.message : "Could not check the test. Try again.",
    );
  }
  return pushTestStatusSchema.parse(data);
}
