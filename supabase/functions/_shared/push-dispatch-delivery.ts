import { buildPushHTTPRequest } from "npm:@pushforge/builder@2.0.5";
import type { createClient } from "https://esm.sh/@supabase/supabase-js@2.112.2";

import {
  buildPushPayload,
  type PushInboxNotification,
  type PushPayload,
} from "./push-payload.ts";
import {
  classifyPushResponse,
  evaluatePushDelivery,
  subscriptionsRequiringDelivery,
  type EvaluatePushDeliveryInput,
  type PushDeliveryDecision,
  type SubscriptionDeliveryOutcome,
} from "./push-delivery-policy.ts";
import { vapidKeysToPrivateJwk, type VapidPrivateJwk } from "./vapid-jwk.ts";

export type PushDeliveryResult = PushDeliveryDecision;

export type OutboxRow = {
  id: string;
  recipient_member_id: string;
  inbox_notification_id: string;
  household_id: string;
  attempt_count: number;
  claim_token: string;
  delivered_subscription_ids: string[];
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

export type DrainCounts = {
  sent: number;
  skipped: number;
  retry: number;
  deferred: number;
  failed: number;
};
type ServiceClient = ReturnType<typeof createClient>;

const MAX_DELIVERY_ATTEMPTS = 5;
const DEFAULT_VAPID_SUBJECT = "mailto:household-os@localhost";

export const DRAIN_COUNT_KEY = {
  sent: "sent",
  skipped_no_subscription: "skipped",
  retry: "retry",
  deferred: "deferred",
  failed: "failed",
} satisfies Record<PushDeliveryDecision["kind"], keyof DrainCounts>;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

async function finalizeClaim(
  supabase: ServiceClient,
  row: OutboxRow,
  decision: PushDeliveryDecision,
): Promise<void> {
  const error =
    decision.kind === "retry" ||
    decision.kind === "deferred" ||
    decision.kind === "failed"
      ? decision.error
      : null;
  const { data, error: rpcError } = await supabase
    .rpc("finalize_push_outbox_claim", {
      p_outbox_id: row.id,
      p_claim_token: row.claim_token,
      p_outcome: decision.kind === "retry" ? "failed" : decision.kind,
      p_error: error,
      p_delivered_subscription_ids: decision.successfulSubscriptionIds,
    })
    .overrideTypes<boolean, { merge: false }>();

  if (rpcError) {
    throw new Error(`push outbox finalization failed: ${rpcError.message}`);
  }
  if (data !== true) {
    throw new Error(`push outbox claim ${row.id} is no longer owned`);
  }
}

async function finishRow(
  supabase: ServiceClient,
  row: OutboxRow,
  decision: PushDeliveryDecision,
): Promise<PushDeliveryDecision> {
  await finalizeClaim(supabase, row, decision);
  return decision;
}

async function finishUnavailableConfiguration(
  supabase: ServiceClient,
  row: OutboxRow,
  policyInput: Omit<EvaluatePushDeliveryInput, "round">,
  config: Exclude<PushConfig, { kind: "ready" }>,
): Promise<PushDeliveryDecision> {
  return finishRow(
    supabase,
    row,
    evaluatePushDelivery({
      ...policyInput,
      round: {
        kind: "configuration_unavailable",
        reason: config.kind,
        error: config.error,
      },
    }),
  );
}

async function sendPush(
  supabase: ServiceClient,
  householdId: string,
  subscription: PushSubscriptionRow,
  payload: PushPayload,
  config: Extract<PushConfig, { kind: "ready" }>,
): Promise<SubscriptionDeliveryOutcome> {
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
      signal: AbortSignal.timeout(15_000),
    });

    const outcome = classifyPushResponse({
      subscriptionId: subscription.id,
      status: response.status,
      statusText: response.statusText,
    });
    if (outcome.kind === "gone") {
      const { error } = await supabase
        .from("push_subscriptions")
        .update({ disabled_at: new Date().toISOString() })
        .eq("id", subscription.id)
        .eq("household_id", householdId)
        .is("disabled_at", null);
      if (error) {
        return {
          kind: "transient_failure",
          subscriptionId: subscription.id,
          error: `subscription ${subscription.id} disable failed: ${error.message}`,
        };
      }
    }
    return outcome;
  } catch (error) {
    return {
      kind: "transient_failure",
      subscriptionId: subscription.id,
      error: `subscription ${subscription.id} failed: ${errorMessage(error)}`,
    };
  }
}

export async function drainRow(
  supabase: ServiceClient,
  row: OutboxRow,
  config: PushConfig,
): Promise<PushDeliveryDecision> {
  const { data: subscriptions, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("household_id", row.household_id)
    .eq("member_id", row.recipient_member_id)
    .is("disabled_at", null)
    .overrideTypes<PushSubscriptionRow[], { merge: false }>();

  if (error) {
    return finishRow(
      supabase,
      row,
      evaluatePushDelivery({
        attemptCount: row.attempt_count,
        maxAttempts: MAX_DELIVERY_ATTEMPTS,
        activeSubscriptionIds: [],
        successfulSubscriptionIds: row.delivered_subscription_ids,
        round: {
          kind: "delivery_state_unavailable",
          error: error.message,
        },
      }),
    );
  }

  const activeSubscriptionIds = subscriptions.map(
    (subscription) => subscription.id,
  );
  const policyInput = {
    attemptCount: row.attempt_count,
    maxAttempts: MAX_DELIVERY_ATTEMPTS,
    activeSubscriptionIds,
    successfulSubscriptionIds: row.delivered_subscription_ids,
  };

  switch (config.kind) {
    case "missing":
    case "invalid":
      return finishUnavailableConfiguration(supabase, row, policyInput, config);
    case "ready":
      break;
    default: {
      const _exhaustive: never = config;
      return _exhaustive;
    }
  }

  const payload = buildPushPayload(row.inbox);
  const pendingSubscriptions = subscriptionsRequiringDelivery(
    subscriptions,
    row.delivered_subscription_ids,
  );
  const deliveries = await Promise.all(
    pendingSubscriptions.map((subscription) =>
      sendPush(supabase, row.household_id, subscription, payload, config),
    ),
  );
  return finishRow(
    supabase,
    row,
    evaluatePushDelivery({
      ...policyInput,
      round: { kind: "subscription_results", outcomes: deliveries },
    }),
  );
}
