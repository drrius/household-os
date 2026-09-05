import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { pushRegistrationError } from "./push-registration-error";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Notification command returned an unexpected payload");
}

export async function upsertDigestPreference(input: {
  enabled: boolean;
  localTime: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("upsert_digest_preference", {
    p_enabled: input.enabled,
    p_local_time: input.localTime,
  });
  if (error) {
    throw new Error(`upsert_digest_preference failed: ${error.message}`);
  }
  return asRecord(data);
}

export async function markInboxNotificationsRead(input: {
  notificationIds: readonly string[];
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_inbox_notifications_read", {
    p_notification_ids: [...input.notificationIds],
  });
  if (error) {
    throw new Error(`mark_inbox_notifications_read failed: ${error.message}`);
  }
  return asRecord(data);
}

export async function registerPushSubscription(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: input.endpoint,
    p_p256dh: input.p256dh,
    p_auth: input.auth,
    p_user_agent: input.userAgent ?? null,
  });
  if (error) {
    throw pushRegistrationError(error);
  }
  return asRecord(data);
}

export async function unregisterPushSubscription(input: {
  endpoint: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unregister_push_subscription", {
    p_endpoint: input.endpoint,
  });
  if (error) {
    throw new Error(`unregister_push_subscription failed: ${error.message}`);
  }
  return asRecord(data);
}
