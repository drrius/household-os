import type {
  ExactAllocations,
  FinancialAllocationInput,
  MemberId,
} from "./types";
import { asCentimeAmount } from "./values";

export type AllocationValidationError = {
  code:
    | "invalid_amount"
    | "same_member"
    | "exact_members_required"
    | "invalid_allocation"
    | "duplicate_member"
    | "allocation_sum_mismatch";
  message: string;
};

export type AllocationValidationResult =
  | { ok: true; allocations: ExactAllocations }
  | { ok: false; error: AllocationValidationError };

function allocationError(
  code: AllocationValidationError["code"],
  message: string,
): AllocationValidationResult {
  return { ok: false, error: { code, message } };
}

export function allocateEqualExpense(
  amountCents: number,
  payerId: MemberId,
  otherId: MemberId,
): ExactAllocations {
  const amount = asCentimeAmount(amountCents);
  if (payerId === otherId) {
    throw new Error("An expense requires two distinct members");
  }
  const otherShare = asCentimeAmount(Math.floor(amount / 2));
  const payerShare = asCentimeAmount(amount - otherShare);
  return [
    { memberId: payerId, allocatedCents: payerShare },
    { memberId: otherId, allocatedCents: otherShare },
  ] as ExactAllocations;
}

export function validateExactAllocations(
  amountCents: number,
  payerId: MemberId,
  otherId: MemberId,
  allocations: readonly FinancialAllocationInput[],
): AllocationValidationResult {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    return allocationError(
      "invalid_amount",
      "Amount must be non-negative safe integer centimes",
    );
  }
  if (payerId === otherId) {
    return allocationError(
      "same_member",
      "Exact allocations require two distinct members",
    );
  }
  if (allocations.length !== 2) {
    return allocationError(
      "exact_members_required",
      "Allocations must contain exactly the two household members",
    );
  }
  const payer = allocations.find(({ memberId }) => memberId === payerId);
  const other = allocations.find(({ memberId }) => memberId === otherId);
  if (payer === undefined || other === undefined) {
    return allocationError(
      "exact_members_required",
      "Allocations must contain exactly the payer and other member",
    );
  }
  if (payer.memberId === other.memberId) {
    return allocationError(
      "duplicate_member",
      "Each household member must have one allocation",
    );
  }
  if (
    !Number.isSafeInteger(payer.allocatedCents) ||
    payer.allocatedCents < 0 ||
    !Number.isSafeInteger(other.allocatedCents) ||
    other.allocatedCents < 0
  ) {
    return allocationError(
      "invalid_allocation",
      "Allocations must be non-negative safe integer centimes",
    );
  }
  const total = payer.allocatedCents + other.allocatedCents;
  if (!Number.isSafeInteger(total) || total !== amountCents) {
    return allocationError(
      "allocation_sum_mismatch",
      "Allocations must sum to the event amount",
    );
  }
  return {
    ok: true,
    allocations: [
      {
        memberId: payerId,
        allocatedCents: asCentimeAmount(payer.allocatedCents),
      },
      {
        memberId: otherId,
        allocatedCents: asCentimeAmount(other.allocatedCents),
      },
    ] as ExactAllocations,
  };
}
