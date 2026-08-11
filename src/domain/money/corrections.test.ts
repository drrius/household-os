import { describe, expect, it } from "vitest";

import { allocateEqualExpense } from "./allocations";
import { deriveMemberBalances } from "./balances";
import { planCorrection } from "./corrections";
import { projectFinancialEvent } from "./projection";
import type { ExpenseEvent, ReplacementEvent, ReversalEvent } from "./types";
import { asCentimeAmount, asFinancialEventId, asMemberId } from "./values";

const payerId = asMemberId("payer");
const otherId = asMemberId("other");

function expense(): ExpenseEvent {
  const amountCents = asCentimeAmount(1_000);
  return {
    id: asFinancialEventId("target"),
    type: "expense",
    amountCents,
    payerMemberId: payerId,
    otherMemberId: otherId,
    allocations: allocateEqualExpense(amountCents, payerId, otherId),
  };
}

describe("planCorrection", () => {
  it("plans a reversal that negates the target", () => {
    const targetEvent = expense();
    const targetLedger = projectFinancialEvent(targetEvent);
    const result = planCorrection({ targetEvent, targetLedger });
    if (!result.ok) {
      throw new Error(result.error.message);
    }
    const reversal: ReversalEvent = {
      id: asFinancialEventId("reversal"),
      ...result.reversal,
    };
    expect(
      projectFinancialEvent(reversal).map(
        (entry) => entry.receivableDeltaCents,
      ),
    ).toEqual(targetLedger.map((entry) => -entry.receivableDeltaCents));
  });

  it("keeps reversal and replacement correction entries balanced", () => {
    const targetEvent = expense();
    const targetLedger = projectFinancialEvent(targetEvent);
    const result = planCorrection({
      targetEvent,
      targetLedger,
      replacement: {
        amountCents: 1_200,
        payerMemberId: payerId,
        otherMemberId: otherId,
        allocations: [
          { memberId: payerId, allocatedCents: 700 },
          { memberId: otherId, allocatedCents: 500 },
        ],
      },
    });
    if (!result.ok || result.replacement === undefined) {
      throw new Error("Expected a correction with replacement");
    }
    const reversal: ReversalEvent = {
      id: asFinancialEventId("reversal"),
      ...result.reversal,
    };
    const replacement: ReplacementEvent = {
      id: asFinancialEventId("replacement"),
      ...result.replacement,
    };
    const correctionLedger = [
      ...projectFinancialEvent(reversal),
      ...projectFinancialEvent(replacement),
    ];
    expect(
      correctionLedger.reduce(
        (sum, entry) => sum + entry.receivableDeltaCents,
        0,
      ),
    ).toBe(0);
    const fullHistory = [...targetLedger, ...correctionLedger];
    expect(deriveMemberBalances(fullHistory)).toEqual(
      deriveMemberBalances(projectFinancialEvent(replacement)),
    );
  });

  it("fails when target ledger does not match the target event", () => {
    const targetEvent = expense();
    const result = planCorrection({
      targetEvent,
      targetLedger: [],
    });
    expect(result).toEqual({
      ok: false,
      error: {
        code: "target_ledger_mismatch",
        message: "Target ledger does not match the target financial event",
      },
    });
  });

  it("returns a validation error for an invalid replacement", () => {
    const targetEvent = expense();
    const result = planCorrection({
      targetEvent,
      targetLedger: projectFinancialEvent(targetEvent),
      replacement: {
        amountCents: -1,
        payerMemberId: payerId,
        otherMemberId: otherId,
        allocations: [
          { memberId: payerId, allocatedCents: 0 },
          { memberId: otherId, allocatedCents: 0 },
        ],
      },
    });
    expect(result.ok).toBe(false);
  });
});
