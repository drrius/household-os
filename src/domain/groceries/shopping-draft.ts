import type { ShoppingExpenseDraftProposal } from "./shopping-types";

export type DraftPlanError = {
  code: "draft_requires_amount" | "unsafe_cent_amount";
  message: string;
};

export function assertSafeNonNegativeCents(
  value: number | null | undefined,
  label: string,
): DraftPlanError | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (!Number.isSafeInteger(value) || value < 0) {
    return {
      code: "unsafe_cent_amount",
      message: `${label} must be a non-negative safe integer number of centimes`,
    };
  }
  return null;
}

export function buildShoppingExpenseDraft(input: {
  createExpenseDraft: boolean;
  description?: string;
  sharedAmountCents?: number | null;
  payerMemberId?: string | null;
  proposedAllocations?: readonly {
    memberId: string;
    allocatedCents: number;
  }[];
  occurredOn: string;
}):
  | { ok: true; draft: ShoppingExpenseDraftProposal | null }
  | { ok: false; error: DraftPlanError } {
  if (!input.createExpenseDraft) {
    return { ok: true, draft: null };
  }

  if (
    input.sharedAmountCents === null ||
    input.sharedAmountCents === undefined ||
    input.payerMemberId === null ||
    input.payerMemberId === undefined
  ) {
    return {
      ok: false,
      error: {
        code: "draft_requires_amount",
        message: "Creating an expense draft requires shared amount and payer",
      },
    };
  }

  return {
    ok: true,
    draft: {
      description: (input.description ?? "Groceries").trim() || "Groceries",
      amountCents: input.sharedAmountCents,
      payerMemberId: input.payerMemberId,
      proposedAllocations: input.proposedAllocations ?? [],
      occurredOn: input.occurredOn,
    },
  };
}
