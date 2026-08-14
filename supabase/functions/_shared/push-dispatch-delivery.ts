import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5";
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

import {
  buildPushPayload,
  type PushInboxNotification,
  type PushPayload,
} from "./push-payload.ts";
import { vapidKeysToPrivateJwk, type VapidPrivateJwk } from "./vapid-jwk.ts";

export type PushDeliveryResult =
  | { kind: "sent" }
  | { kind: "skipped_no_subscription" }
  | { kind: "failed"; error: string }
  | { kind: "gone" };

export type OutboxDeliveryResult = Exclude<
  PushDeliveryResult,
  { kind: "gone" }
>;

type SubscriptionDeliveryResult = Exclude<
  PushDeliveryResult,
  { kind: "skipped_no_subscription" }
>;

export type OutboxRow = {
  id: string;
  recipient_member_id: string;
  inbox_notification_id: string;
  household_id: string;
  attempt_count: number;
  inbox: PushInboxNotification;
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushConfig =
  | {
      kind: "ready";
      privateJwk: VapidPrivateJwk;
      subject: string;
    }
  | { kind: "missing"; error: string }
  | { kind: "invalid"; error: string };

export type DrainCounts = { sent: number; skipped: number; failed: number };
type ServiceClient = ReturnType<typeof createClient>;

const MAX_ERROR_LENGTH = 1000;
const MAX_DELIVERY_ATTEMPTS = 5;
const DEFAULT_VAPID_SUBJECT = "mailto:household-os@localhost";

export const DRAIN_COUNT_KEY = {
  sent: "sent",
  skipped_no_subscription: "skipped",
  failed: "failed",
} satisfies Record<OutboxDeliveryResult["kind"], keyof DrainCounts>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function truncateError(error: string): string {
  return error.slice(0, MAX_ERROR_LENGTH);
}

export function loadPushConfig(): PushConfig {
  const publicKey = Deno.env.get("VAPID_PUBLIC_KEY");
  const privateKey = Deno.env.get("VAPID_PRIVATE_KEY");
  if (!publicKey || !privateKey) {
    return { kind: "missing", error: "vapid secrets not configured" };
  }

  try {
    return {
      kind: "ready",
      privateJwk: vapidKeysToPrivateJwk(publicKey, privateKey),
      subject: Deno.env.get("VAPID_SUBJECT")?.trim() || DEFAULT_VAPID_SUBJECT,
    };
  } catch (error) {
    return {
      kind: "invalid",
      error: `invalid vapid secrets: ${errorMessage(error)}`,
    };
  }
}

async function markOutbox(
  supabase: ServiceClient,
  row: OutboxRow,
  result: OutboxDeliveryResult,
  skippedError: string | null = null,
): Promise<void> {
  const processedAt = new Date().toISOString();
  const update = (() => {
    switch (result.kind) {
      case "sent":
        return {
          status: "sent",
          last_error: null,
          processed_at: processedAt,
        };
      case "skipped_no_subscription":
        return {
          status: "skipped_no_subscription",
          last_error:
            skippedError === null ? null : truncateError(skippedError),
          processed_at: processedAt,
        };
      case "failed": {
        const attemptCount = row.attempt_count + 1;
        if (attemptCount >= MAX_DELIVERY_ATTEMPTS) {
          return {
            status: "failed",
            last_error: truncateError(result.error),
            attempt_count: attemptCount,
            processed_at: processedAt,
          };
        }
        return {
          status: "pending",
          last_error: truncateError(result.error),
          attempt_count: attemptCount,
          processed_at: null,
        };
      }
      default: {
        const _exhaustive: never = result;
        return _exhaustive;
      }
    }
  })();

  const { error } = await supabase
    .from("push_outbox")
    .update(update)
    .eq("id", row.id)
    .eq("household_id", row.household_id)
    .eq("status", "pending");

  if (error) {
    throw new Error(`push outbox update failed: ${error.message}`);
  }
}

async function finishRow(
  supabase: ServiceClient,
  row: OutboxRow,
  result: OutboxDeliveryResult,
  skippedError: string | null = null,
): Promise<OutboxDeliveryResult> {
  await markOutbox(supabase, row, result, skippedError);
  return result;
}

async function sendPush(
  supabase: ServiceClient,
  householdId: string,
  subscription: PushSubscriptionRow,
  payload: PushPayload,
  config: Extract<PushConfig, { kind: "ready" }>,
): Promise<SubscriptionDeliveryResult> {
  try {
    const pushRequest = await buildPushHTTPRequest({
      privateJWK: config.privateJwk,
      subscription: {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      message: {
        payload,
        adminContact: config.subject,
      },
    });
    const response = await fetch(pushRequest.endpoint, {
      method: "POST",
      headers: pushRequest.headers,
      body: pushRequest.body,
    });

    if (response.ok) {
      return { kind: "sent" };
    }

    if (response.status === 404 || response.status === 410) {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", subscription.id)
        .eq("household_id", householdId)
        .is("disabled_at", null);
      if (error) {
        return {
          kind: "failed",
          error: `subscription ${subscription.id} disable failed: ${error.message}`,
        };
      }
      return { kind: "gone" };
    }

    const statusText = response.statusText ? ` ${response.statusText}` : "";
    return {
      kind: "failed",
      error: `subscription ${subscription.id} returned HTTP ${response.status}${statusText}`,
    };
  } catch (error) {
    return {
      kind: "failed",
      error: `subscription ${subscription.id} failed: ${errorMessage(error)}`,
    };
  }
}

export async function drainRow(
  supabase: ServiceClient,
  row: OutboxRow,
  config: PushConfig,
): Promise<OutboxDeliveryResult> {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("household_id", row.household_id)
    .eq("member_id", row.recipient_member_id)
    .is("disabled_at", null)
    .overrideTypes<PushSubscriptionRow[], { merge: false }>();

  if (error) {
    return finishRow(supabase, row, {
      kind: "failed",
      error: error.message,
    });
  }

  if (subscriptions.length === 0) {
    return finishRow(supabase, row, { kind: "skipped_no_subscription" });
  }

  switch (config.kind) {
    case "missing":
      return finishRow(
        supabase,
        row,
        { kind: "skipped_no_subscription" },
        config.error,
      );
    case "invalid":
      return finishRow(supabase, row, {
        kind: "failed",
        error: config.error,
      });
    case "ready":
      break;
    default: {
      const _exhaustive: never = config;
      return _exhaustive;
    }
  }

  const payload = buildPushPayload(row.inbox);
  const deliveries = await Promise.all(
    subscriptions.map((subscription) =>
      sendPush(supabase, row.household_id, subscription, payload, config),
    ),
  );

  if (deliveries.some((delivery) => delivery.kind === "sent")) {
    return finishRow(supabase, row, { kind: "sent" });
  }

  if (deliveries.every((delivery) => delivery.kind === "gone")) {
    return finishRow(supabase, row, { kind: "skipped_no_subscription" });
  }

  const errors = deliveries.flatMap((delivery) =>
    delivery.kind === "failed" ? [delivery.error] : [],
  );
  return finishRow(supabase, row, {
    kind: "failed",
    error: errors.join("; "),
  });
}
