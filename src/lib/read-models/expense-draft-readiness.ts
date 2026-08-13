import { z } from "zod";

import { validateExactAllocations } from "@/domain/money/allocations";
import { asMemberId } from "@/domain/money/values";

export const proposedAllocationSchema = z.object({
  memberId: z.string().min(1),
  allocatedCents: z.number().int(),
});

export type ExpenseDraftBlocker = "amount" | "payer" | "members" | "split";

export type ExpenseDraftReadiness =
  { ready: true } | { ready: false; blocker: ExpenseDraftBlocker };

export type ExpenseDraftReadinessInput = {
  amountCents: number | null;
  payerMemberId: string | null;
  memberIds: readonly string[];
  proposedAllocations: unknown;
};

export const EXPENSE_DRAFT_BLOCKER_COPY: Record<ExpenseDraftBlocker, string> = {
  amount: "Add the amount before confirming",
  payer: "Say who paid before confirming",
  members: "This household needs exactly two members",
  split: "Set how this splits before confirming",
};

/** Names the single reason a draft cannot be confirmed yet. */
export function getExpenseDraftReadiness(
  input: ExpenseDraftReadinessInput,
): ExpenseDraftReadiness {
  if (input.amountCents === null) {
    return { ready: false, blocker: "amount" };
  }
  if (input.payerMemberId === null) {
    return { ready: false, blocker: "payer" };
  }

  const otherMemberId = input.memberIds.find(
    (memberId) => memberId !== input.payerMemberId,
  );
  if (otherMemberId === undefined || input.memberIds.length !== 2) {
    return { ready: false, blocker: "members" };
  }

  const parsed = z
    .array(proposedAllocationSchema)
    .safeParse(input.proposedAllocations);
  if (!parsed.success) {
    return { ready: false, blocker: "split" };
  }

  const validated = validateExactAllocations(
    input.amountCents,
    asMemberId(input.payerMemberId),
    asMemberId(otherMemberId),
    parsed.data.map((allocation) => ({
      memberId: asMemberId(allocation.memberId),
      allocatedCents: allocation.allocatedCents,
    })),
  );
  return validated.ok ? { ready: true } : { ready: false, blocker: "split" };
}

export function isExpenseDraftReady(
  input: ExpenseDraftReadinessInput,
): boolean {
  return getExpenseDraftReadiness(input).ready;
}
