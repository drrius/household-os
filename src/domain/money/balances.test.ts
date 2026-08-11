import { describe, expect, it } from "vitest";

import { allocateEqualExpense } from "./allocations";
import { deriveMemberBalances, explainBalance } from "./balances";
import { projectFinancialEvent } from "./projection";
import type { ExpenseEvent, OpeningBalanceEvent } from "./types";
import { asCentimeAmount, asFinancialEventId, asMemberId } from "./values";

const payerId = asMemberId("payer");
const otherId = asMemberId("other");

describe("member balances", () => {
  it("derives balances from ledger entries", () => {
    const entries = [
      {
        financialEventId: asFinancialEventId("expense"),
        memberId: payerId,
        receivableDeltaCents: 500,
      },
      {
        financialEventId: asFinancialEventId("expense"),
        memberId: otherId,
        receivableDeltaCents: -500,
      },
    ];
    expect(deriveMemberBalances(entries)).toEqual(
      new Map([
        [payerId, 500],
        [otherId, -500],
      ]),
    );
  });

  it("shows each event contribution to each member balance", () => {
    const opening: OpeningBalanceEvent = {
      id: asFinancialEventId("opening"),
      type: "opening_balance",
      amountCents: asCentimeAmount(300),
      payerMemberId: payerId,
      otherMemberId: otherId,
    };
    const amountCents = asCentimeAmount(1_000);
    const expense: ExpenseEvent = {
      id: asFinancialEventId("expense"),
      type: "expense",
      amountCents,
      payerMemberId: payerId,
      otherMemberId: otherId,
      allocations: allocateEqualExpense(amountCents, payerId, otherId),
    };
    const entries = [
      ...projectFinancialEvent(opening),
      ...projectFinancialEvent(expense),
    ];
    expect(explainBalance(entries, [opening, expense])).toEqual([
      {
        memberId: payerId,
        balanceCents: 800,
        contributions: [
          {
            financialEventId: opening.id,
            eventType: "opening_balance",
            deltaCents: 300,
          },
          {
            financialEventId: expense.id,
            eventType: "expense",
            deltaCents: 500,
          },
        ],
      },
      {
        memberId: otherId,
        balanceCents: -800,
        contributions: [
          {
            financialEventId: opening.id,
            eventType: "opening_balance",
            deltaCents: -300,
          },
          {
            financialEventId: expense.id,
            eventType: "expense",
            deltaCents: -500,
          },
        ],
      },
    ]);
  });

  it("rejects unsafe ledger deltas", () => {
    expect(() =>
      deriveMemberBalances([
        {
          financialEventId: asFinancialEventId("unsafe"),
          memberId: payerId,
          receivableDeltaCents: Number.MAX_SAFE_INTEGER + 1,
        },
      ]),
    ).toThrow();
  });
});
