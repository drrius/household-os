export type MemberId = string;

export interface ExpenseAllocation {
  memberId: MemberId;
  allocatedCents: number;
}

export interface LedgerEntry {
  memberId: MemberId;
  receivableDeltaCents: number;
}

function assertCentAmount(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      `${label} must be a non-negative safe integer number of centimes`,
    );
  }
}

export function allocateEqualExpense(
  amountCents: number,
  payerId: MemberId,
  otherMemberId: MemberId,
): ExpenseAllocation[] {
  assertCentAmount(amountCents, "Expense amount");

  if (payerId === otherMemberId) {
    throw new Error("An expense requires two distinct members");
  }

  const otherShare = Math.floor(amountCents / 2);

  return [
    { memberId: payerId, allocatedCents: amountCents - otherShare },
    { memberId: otherMemberId, allocatedCents: otherShare },
  ];
}

export function deriveMemberBalances(
  entries: readonly LedgerEntry[],
): Map<MemberId, number> {
  const balances = new Map<MemberId, number>();

  for (const entry of entries) {
    if (!Number.isSafeInteger(entry.receivableDeltaCents)) {
      throw new Error("Ledger deltas must be safe integer centimes");
    }

    balances.set(
      entry.memberId,
      (balances.get(entry.memberId) ?? 0) + entry.receivableDeltaCents,
    );
  }

  return balances;
}
