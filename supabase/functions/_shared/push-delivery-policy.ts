export type SubscriptionDeliveryOutcome =
  | { kind: "sent"; subscriptionId: string }
  | { kind: "gone"; subscriptionId: string }
  | {
      kind: "transient_failure";
      subscriptionId: string;
      error: string;
    };

export type PushDeliveryRound =
  | {
      kind: "configuration_unavailable";
      reason: "missing" | "invalid";
      error: string;
    }
  | {
      kind: "delivery_state_unavailable";
      error: string;
    }
  | {
      kind: "subscription_results";
      outcomes: readonly SubscriptionDeliveryOutcome[];
    };

type TerminalDeliveryDecision =
  | {
      kind: "sent";
      successfulSubscriptionIds: readonly string[];
    }
  | {
      kind: "skipped_no_subscription";
      successfulSubscriptionIds: readonly string[];
    };

type UnsuccessfulDeliveryDecision =
  | {
      kind: "retry";
      successfulSubscriptionIds: readonly string[];
      error: string;
      attemptCount: number;
    }
  | {
      kind: "failed";
      successfulSubscriptionIds: readonly string[];
      error: string;
      attemptCount: number;
    };

export type PushDeliveryDecision =
  | TerminalDeliveryDecision
  | {
      kind: "deferred";
      successfulSubscriptionIds: readonly string[];
      error: string;
    }
  | UnsuccessfulDeliveryDecision;

export type EvaluatePushDeliveryInput = {
  attemptCount: number;
  maxAttempts: number;
  activeSubscriptionIds: readonly string[];
  successfulSubscriptionIds: readonly string[];
  round: PushDeliveryRound;
};

export function subscriptionsRequiringDelivery<
  Subscription extends { readonly id: string },
>(
  subscriptions: readonly Subscription[],
  successfulSubscriptionIds: readonly string[],
): Subscription[] {
  const successfulSet = new Set(successfulSubscriptionIds);
  return subscriptions.filter(
    (subscription) => !successfulSet.has(subscription.id),
  );
}

export function classifyPushResponse({
  subscriptionId,
  status,
  statusText,
}: {
  subscriptionId: string;
  status: number;
  statusText: string;
}): SubscriptionDeliveryOutcome {
  if (status >= 200 && status < 300) {
    return { kind: "sent", subscriptionId };
  }
  if (status === 404 || status === 410) {
    return { kind: "gone", subscriptionId };
  }
  const suffix = statusText ? ` ${statusText}` : "";
  return {
    kind: "transient_failure",
    subscriptionId,
    error: `subscription ${subscriptionId} returned HTTP ${status}${suffix}`,
  };
}

function unique(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function unsuccessfulDecision(
  input: EvaluatePushDeliveryInput,
  successfulSubscriptionIds: readonly string[],
  error: string,
): UnsuccessfulDeliveryDecision {
  const attemptCount = input.attemptCount + 1;
  if (attemptCount >= input.maxAttempts) {
    return {
      kind: "failed",
      successfulSubscriptionIds,
      error,
      attemptCount,
    };
  }

  return {
    kind: "retry",
    successfulSubscriptionIds,
    error,
    attemptCount,
  };
}

function evaluateSubscriptionResults({
  input,
  pendingSubscriptionIds,
  successfulSubscriptionIds,
  outcomes,
}: {
  input: EvaluatePushDeliveryInput;
  pendingSubscriptionIds: readonly string[];
  successfulSubscriptionIds: string[];
  outcomes: readonly SubscriptionDeliveryOutcome[];
}): PushDeliveryDecision {
  const pendingSet = new Set(pendingSubscriptionIds);
  const successfulSet = new Set(successfulSubscriptionIds);
  const completedSet = new Set<string>();
  const errors: string[] = [];

  for (const outcome of outcomes) {
    if (!pendingSet.has(outcome.subscriptionId)) {
      continue;
    }

    switch (outcome.kind) {
      case "sent":
        if (!successfulSet.has(outcome.subscriptionId)) {
          successfulSubscriptionIds.push(outcome.subscriptionId);
          successfulSet.add(outcome.subscriptionId);
        }
        completedSet.add(outcome.subscriptionId);
        break;
      case "gone":
        completedSet.add(outcome.subscriptionId);
        break;
      case "transient_failure":
        completedSet.add(outcome.subscriptionId);
        errors.push(outcome.error);
        break;
      default: {
        const _exhaustive: never = outcome;
        return _exhaustive;
      }
    }
  }

  const missingResultIds = pendingSubscriptionIds.filter(
    (subscriptionId) => !completedSet.has(subscriptionId),
  );
  if (missingResultIds.length > 0) {
    errors.push(
      `missing delivery results for subscriptions: ${missingResultIds.join(", ")}`,
    );
  }

  if (errors.length > 0) {
    return unsuccessfulDecision(
      input,
      successfulSubscriptionIds,
      errors.join("; "),
    );
  }

  if (successfulSubscriptionIds.length > 0) {
    return { kind: "sent", successfulSubscriptionIds };
  }

  return {
    kind: "skipped_no_subscription",
    successfulSubscriptionIds,
  };
}

export function evaluatePushDelivery(
  input: EvaluatePushDeliveryInput,
): PushDeliveryDecision {
  const activeSubscriptionIds = unique(input.activeSubscriptionIds);
  const successfulSubscriptionIds = unique(input.successfulSubscriptionIds);

  if (input.round.kind === "delivery_state_unavailable") {
    return unsuccessfulDecision(
      input,
      successfulSubscriptionIds,
      input.round.error,
    );
  }

  const successfulSet = new Set(successfulSubscriptionIds);
  const pendingSubscriptionIds = activeSubscriptionIds.filter(
    (subscriptionId) => !successfulSet.has(subscriptionId),
  );

  if (pendingSubscriptionIds.length === 0) {
    if (
      activeSubscriptionIds.length === 0 &&
      successfulSubscriptionIds.length === 0
    ) {
      return {
        kind: "skipped_no_subscription",
        successfulSubscriptionIds,
      };
    }

    return { kind: "sent", successfulSubscriptionIds };
  }

  switch (input.round.kind) {
    case "configuration_unavailable":
      return {
        kind: "deferred",
        successfulSubscriptionIds,
        error: input.round.error,
      };
    case "subscription_results":
      return evaluateSubscriptionResults({
        input,
        pendingSubscriptionIds,
        successfulSubscriptionIds,
        outcomes: input.round.outcomes,
      });
    default: {
      const _exhaustive: never = input.round;
      return _exhaustive;
    }
  }
}
