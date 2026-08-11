import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { allocateEqualExpense } from "./allocations";
import { projectFinancialEvent } from "./projection";
import type { FinancialEvent, FinancialEventType } from "./types";
import { asCentimeAmount, asFinancialEventId, asMemberId } from "./values";

const payerId = asMemberId("payer");
const otherId = asMemberId("other");

function eventId(value: string) {
  return asFinancialEventId(value);
}

function eventFor(
  type: FinancialEventType,
  rawAmountCents: number,
): FinancialEvent {
  const amountCents = asCentimeAmount(rawAmountCents);
  const allocations = allocateEqualExpense(amountCents, payerId, otherId);
  switch (type) {
    case "opening_balance":
      return {
        id: eventId(type),
        type,
        amountCents,
        payerMemberId: payerId,
        otherMemberId: otherId,
      };
    case "expense":
    case "refund":
    case "replacement":
      return {
        id: eventId(type),
        type,
        amountCents,
        payerMemberId: payerId,
        otherMemberId: otherId,
        allocations,
      };
    case "settlement":
      return {
        id: eventId(type),
        type,
        amountCents,
        payerMemberId: payerId,
        otherMemberId: otherId,
      };
    case "reversal": {
      const target = eventFor("expense", amountCents);
      return {
        id: eventId(type),
        type,
        amountCents,
        relatedEventId: target.id,
        relatedLedgerEntries: projectFinancialEvent(target),
      };
    }
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}

describe("projectFinancialEvent", () => {
  it("projects an opening balance toward the creditor", () => {
    expect(projectFinancialEvent(eventFor("opening_balance", 1_200))).toEqual([
      {
        financialEventId: eventId("opening_balance"),
        memberId: payerId,
        receivableDeltaCents: 1_200,
      },
      {
        financialEventId: eventId("opening_balance"),
        memberId: otherId,
        receivableDeltaCents: -1_200,
      },
    ]);
  });

  it("projects expense and refund as economic inverses", () => {
    const expense = eventFor("expense", 1_001);
    const refund = eventFor("refund", 1_001);
    expect(
      projectFinancialEvent(expense).map((entry) => entry.receivableDeltaCents),
    ).toEqual([500, -500]);
    expect(
      projectFinancialEvent(refund).map((entry) => entry.receivableDeltaCents),
    ).toEqual([-500, 500]);
  });

  it("projects an external settlement toward its payer", () => {
    expect(
      projectFinancialEvent(eventFor("settlement", 750)).map(
        (entry) => entry.receivableDeltaCents,
      ),
    ).toEqual([750, -750]);
  });

  it("projects replacement with expense semantics", () => {
    expect(
      projectFinancialEvent(eventFor("replacement", 999)).map(
        (entry) => entry.receivableDeltaCents,
      ),
    ).toEqual([499, -499]);
  });

  it("negates every related ledger entry for a reversal", () => {
    const target = eventFor("expense", 1_001);
    const targetLedger = projectFinancialEvent(target);
    const reversal: FinancialEvent = {
      id: eventId("reversal-example"),
      type: "reversal",
      amountCents: target.amountCents,
      relatedEventId: target.id,
      relatedLedgerEntries: targetLedger,
    };
    expect(
      projectFinancialEvent(reversal).map(
        (entry) => entry.receivableDeltaCents,
      ),
    ).toEqual(targetLedger.map((entry) => -entry.receivableDeltaCents));
  });

  it("balances every financial event type for every safe test amount", () => {
    fc.assert(
      fc.property(
        fc.constantFrom<FinancialEventType>(
          "opening_balance",
          "expense",
          "refund",
          "settlement",
          "reversal",
          "replacement",
        ),
        fc.integer({ min: 0, max: 1_000_000_000 }),
        (type, amountCents) => {
          const total = projectFinancialEvent(
            eventFor(type, amountCents),
          ).reduce((sum, entry) => sum + entry.receivableDeltaCents, 0);
          expect(total).toBe(0);
        },
      ),
    );
  });
});
