import { describe, expect, it } from "vitest";

import {
  classifyPushResponse,
  evaluatePushDelivery,
  subscriptionsRequiringDelivery,
  type EvaluatePushDeliveryInput,
  type PushDeliveryRound,
} from "../supabase/functions/_shared/push-delivery-policy.ts";

describe("classifyPushResponse", () => {
  it.each([200, 201, 204, 299])("accepts HTTP %i as sent", (status) => {
    expect(
      classifyPushResponse({
        subscriptionId: "subscription-a",
        status,
        statusText: "",
      }),
    ).toEqual({ kind: "sent", subscriptionId: "subscription-a" });
  });

  it.each([404, 410])("disables HTTP %i subscriptions as gone", (status) => {
    expect(
      classifyPushResponse({
        subscriptionId: "subscription-a",
        status,
        statusText: "Gone",
      }),
    ).toEqual({ kind: "gone", subscriptionId: "subscription-a" });
  });

  it("keeps throttling and server failures retryable", () => {
    expect(
      classifyPushResponse({
        subscriptionId: "subscription-a",
        status: 503,
        statusText: "Service Unavailable",
      }),
    ).toEqual({
      kind: "transient_failure",
      subscriptionId: "subscription-a",
      error:
        "subscription subscription-a returned HTTP 503 Service Unavailable",
    });
  });
});

function evaluate(
  round: PushDeliveryRound,
  overrides: Partial<Omit<EvaluatePushDeliveryInput, "round">> = {},
) {
  return evaluatePushDelivery({
    attemptCount: 0,
    maxAttempts: 5,
    activeSubscriptionIds: ["subscription-a"],
    successfulSubscriptionIds: [],
    ...overrides,
    round,
  });
}

describe("evaluatePushDelivery", () => {
  it("skips when there are no active subscriptions", () => {
    expect(
      evaluate(
        { kind: "subscription_results", outcomes: [] },
        { activeSubscriptionIds: [] },
      ),
    ).toEqual({
      kind: "skipped_no_subscription",
      successfulSubscriptionIds: [],
    });
  });

  it("finishes as sent when every active subscription was already successful", () => {
    expect(
      evaluate(
        {
          kind: "configuration_unavailable",
          reason: "missing",
          error: "vapid secrets not configured",
        },
        { successfulSubscriptionIds: ["subscription-a"] },
      ),
    ).toEqual({
      kind: "sent",
      successfulSubscriptionIds: ["subscription-a"],
    });
  });

  it("finishes as sent when all subscriptions are sent", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            { kind: "sent", subscriptionId: "subscription-a" },
            { kind: "sent", subscriptionId: "subscription-b" },
          ],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toEqual({
      kind: "sent",
      successfulSubscriptionIds: ["subscription-a", "subscription-b"],
    });
  });

  it("skips when all active subscriptions are gone", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            { kind: "gone", subscriptionId: "subscription-a" },
            { kind: "gone", subscriptionId: "subscription-b" },
          ],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toEqual({
      kind: "skipped_no_subscription",
      successfulSubscriptionIds: [],
    });
  });

  it("finishes as sent for a mixture of sent and gone subscriptions", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            { kind: "sent", subscriptionId: "subscription-a" },
            { kind: "gone", subscriptionId: "subscription-b" },
          ],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toEqual({
      kind: "sent",
      successfulSubscriptionIds: ["subscription-a"],
    });
  });

  it("retries mixed success and transient failure while retaining successes", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            { kind: "sent", subscriptionId: "subscription-b" },
            {
              kind: "transient_failure",
              subscriptionId: "subscription-c",
              error: "push service unavailable",
            },
          ],
        },
        {
          attemptCount: 2,
          activeSubscriptionIds: [
            "subscription-a",
            "subscription-b",
            "subscription-c",
          ],
          successfulSubscriptionIds: ["subscription-a"],
        },
      ),
    ).toEqual({
      kind: "retry",
      successfulSubscriptionIds: ["subscription-a", "subscription-b"],
      error: "push service unavailable",
      attemptCount: 3,
    });
  });

  it("defers missing VAPID configuration", () => {
    expect(
      evaluate({
        kind: "configuration_unavailable",
        reason: "missing",
        error: "missing vapid configuration",
      }),
    ).toEqual({
      kind: "deferred",
      successfulSubscriptionIds: [],
      error: "missing vapid configuration",
    });
  });

  it("defers invalid VAPID configuration", () => {
    expect(
      evaluate({
        kind: "configuration_unavailable",
        reason: "invalid",
        error: "invalid vapid configuration",
      }),
    ).toEqual({
      kind: "deferred",
      successfulSubscriptionIds: [],
      error: "invalid vapid configuration",
    });
  });

  it("retries when subscription state cannot be loaded", () => {
    expect(
      evaluate(
        {
          kind: "delivery_state_unavailable",
          error: "database unavailable",
        },
        { activeSubscriptionIds: [] },
      ),
    ).toEqual({
      kind: "retry",
      successfulSubscriptionIds: [],
      error: "database unavailable",
      attemptCount: 1,
    });
  });

  it("fails a transient delivery when the retry cap is reached", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            {
              kind: "transient_failure",
              subscriptionId: "subscription-a",
              error: "HTTP 503 Service Unavailable",
            },
          ],
        },
        { attemptCount: 4 },
      ),
    ).toEqual({
      kind: "failed",
      successfulSubscriptionIds: [],
      error: "HTTP 503 Service Unavailable",
      attemptCount: 5,
    });
  });

  it("defers unavailable configuration without consuming the final attempt", () => {
    expect(
      evaluate(
        {
          kind: "configuration_unavailable",
          reason: "missing",
          error: "vapid secrets not configured",
        },
        { attemptCount: 4 },
      ),
    ).toEqual({
      kind: "deferred",
      successfulSubscriptionIds: [],
      error: "vapid secrets not configured",
    });
  });

  it("keeps gone plus transient failure retryable", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            { kind: "gone", subscriptionId: "subscription-a" },
            {
              kind: "transient_failure",
              subscriptionId: "subscription-b",
              error: "network timeout",
            },
          ],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toEqual({
      kind: "retry",
      successfulSubscriptionIds: [],
      error: "network timeout",
      attemptCount: 1,
    });
  });

  it("reports every transient failure in subscription order", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [
            {
              kind: "transient_failure",
              subscriptionId: "subscription-a",
              error: "first failure",
            },
            {
              kind: "transient_failure",
              subscriptionId: "subscription-b",
              error: "second failure",
            },
          ],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toMatchObject({
      kind: "retry",
      error: "first failure; second failure",
    });
  });

  it("makes an omitted delivery result retryable", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [{ kind: "sent", subscriptionId: "subscription-a" }],
        },
        { activeSubscriptionIds: ["subscription-a", "subscription-b"] },
      ),
    ).toEqual({
      kind: "retry",
      successfulSubscriptionIds: ["subscription-a"],
      error: "missing delivery results for subscriptions: subscription-b",
      attemptCount: 1,
    });
  });

  it("deduplicates active and retained successful subscription IDs", () => {
    expect(
      evaluate(
        {
          kind: "subscription_results",
          outcomes: [{ kind: "sent", subscriptionId: "subscription-b" }],
        },
        {
          activeSubscriptionIds: [
            "subscription-a",
            "subscription-a",
            "subscription-b",
          ],
          successfulSubscriptionIds: ["subscription-a", "subscription-a"],
        },
      ),
    ).toEqual({
      kind: "sent",
      successfulSubscriptionIds: ["subscription-a", "subscription-b"],
    });
  });
});

describe("subscriptionsRequiringDelivery", () => {
  it("excludes successful subscriptions from a retry without losing row data", () => {
    const subscriptions = [
      { id: "subscription-a", endpoint: "https://push.example/a" },
      { id: "subscription-b", endpoint: "https://push.example/b" },
    ];

    expect(
      subscriptionsRequiringDelivery(subscriptions, ["subscription-a"]),
    ).toEqual([{ id: "subscription-b", endpoint: "https://push.example/b" }]);
  });
});
