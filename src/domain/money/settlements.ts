import type { MemberId } from "./types";
import { asCentimeAmount, asMemberId } from "./values";

export function settlementAmount(input: {
  outstandingCents: number;
  mode: "full" | "partial";
  requestedCents: number | null;
}): number {
  const outstanding = asCentimeAmount(input.outstandingCents);
  if (outstanding === 0)
    throw new Error("The household is already settled up.");
  if (input.mode === "full") return outstanding;
  if (
    input.requestedCents === null ||
    !Number.isSafeInteger(input.requestedCents) ||
    input.requestedCents <= 0 ||
    input.requestedCents > outstanding
  ) {
    throw new Error("A partial settlement must be within the current balance.");
  }
  return input.requestedCents;
}

export type MemberReceivable = {
  memberId: MemberId;
  receivableCents: number;
};

export function prepareSettlement(input: {
  balances: readonly MemberReceivable[];
  payerMemberId: MemberId;
  mode: "full" | "partial";
  requestedCents: number | null;
}): { amountCents: number; debtorMemberId: MemberId } {
  if (input.balances.length !== 2) {
    throw new Error("Money commands require exactly two household members");
  }
  const first = input.balances[0];
  const second = input.balances[1];
  if (first === undefined || second === undefined) {
    throw new Error("Money commands require exactly two household members");
  }
  if (first.receivableCents + second.receivableCents !== 0) {
    throw new Error("The household balance could not be reconciled.");
  }
  const debtor = input.balances.find((balance) => balance.receivableCents < 0);
  if (debtor === undefined) {
    throw new Error("The household is already settled up.");
  }
  if (asMemberId(input.payerMemberId) !== debtor.memberId) {
    throw new Error(
      "The named payer does not currently owe the outstanding balance.",
    );
  }
  return {
    amountCents: settlementAmount({
      outstandingCents: Math.abs(debtor.receivableCents),
      mode: input.mode,
      requestedCents: input.requestedCents,
    }),
    debtorMemberId: debtor.memberId,
  };
}
