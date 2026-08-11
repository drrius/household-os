import { validateExactAllocations } from "./allocations";
import type {
  ExpenseEvent,
  FinancialEvent,
  LedgerEntry,
  RefundEvent,
  ReplacementEvent,
} from "./types";
import {
  addSignedCentimes,
  asCentimeAmount,
  assertSignedCentimes,
} from "./values";

type ExpenseLikeEvent = ExpenseEvent | RefundEvent | ReplacementEvent;

function projectExpenseLike(
  event: ExpenseLikeEvent,
  direction: 1 | -1,
): LedgerEntry[] {
  const result = validateExactAllocations(
    event.amountCents,
    event.payerMemberId,
    event.otherMemberId,
    event.allocations,
  );
  if (!result.ok) {
    throw new Error(
      `Invalid ${event.type} allocations: ${result.error.message}`,
    );
  }
  const [payerAllocation, otherAllocation] = result.allocations;
  const payerDelta =
    direction * (event.amountCents - payerAllocation.allocatedCents);
  const otherDelta = direction * -otherAllocation.allocatedCents;
  return [
    {
      financialEventId: event.id,
      memberId: event.payerMemberId,
      receivableDeltaCents: payerDelta,
    },
    {
      financialEventId: event.id,
      memberId: event.otherMemberId,
      receivableDeltaCents: otherDelta,
    },
  ];
}

function projectTransfer(
  event: Extract<FinancialEvent, { type: "opening_balance" | "settlement" }>,
): LedgerEntry[] {
  if (event.payerMemberId === event.otherMemberId) {
    throw new Error(`${event.type} requires two distinct members`);
  }
  return [
    {
      financialEventId: event.id,
      memberId: event.payerMemberId,
      receivableDeltaCents: event.amountCents,
    },
    {
      financialEventId: event.id,
      memberId: event.otherMemberId,
      receivableDeltaCents: -event.amountCents,
    },
  ];
}

function projectReversal(
  event: Extract<FinancialEvent, { type: "reversal" }>,
): LedgerEntry[] {
  return event.relatedLedgerEntries.map((entry) => {
    if (entry.financialEventId !== event.relatedEventId) {
      throw new Error("Reversal entries must belong to the related event");
    }
    assertSignedCentimes(entry.receivableDeltaCents, "Related ledger delta");
    return {
      financialEventId: event.id,
      memberId: entry.memberId,
      receivableDeltaCents: -entry.receivableDeltaCents,
    };
  });
}

function assertZeroSum(entries: readonly LedgerEntry[]): void {
  const total = entries.reduce(
    (sum, entry) =>
      addSignedCentimes(sum, entry.receivableDeltaCents, "Ledger total"),
    0,
  );
  if (total !== 0) {
    throw new Error(`Financial event ledger is not balanced: ${total}`);
  }
}

export function projectFinancialEvent(event: FinancialEvent): LedgerEntry[] {
  asCentimeAmount(event.amountCents);
  let entries: LedgerEntry[];
  switch (event.type) {
    case "opening_balance":
    case "settlement":
      entries = projectTransfer(event);
      break;
    case "expense":
    case "replacement":
      entries = projectExpenseLike(event, 1);
      break;
    case "refund":
      entries = projectExpenseLike(event, -1);
      break;
    case "reversal":
      entries = projectReversal(event);
      break;
    default: {
      const _exhaustive: never = event;
      return _exhaustive;
    }
  }
  for (const entry of entries) {
    assertSignedCentimes(entry.receivableDeltaCents, "Ledger delta");
  }
  assertZeroSum(entries);
  return entries;
}
