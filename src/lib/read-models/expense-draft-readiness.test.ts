import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { allocateEqualExpense } from "@/domain/money/allocations";
import { asMemberId } from "@/domain/money/values";

import {
  getExpenseDraftReadiness,
  isExpenseDraftReady,
  type ExpenseDraftReadinessInput,
} from "./expense-draft-readiness";

const payerId = "user-1";
const otherId = "user-2";

function draft(
  overrides: Partial<ExpenseDraftReadinessInput> = {},
): ExpenseDraftReadinessInput {
  return {
    amountCents: 2_351,
    payerMemberId: payerId,
    memberIds: [payerId, otherId],
    proposedAllocations: [
      { memberId: payerId, allocatedCents: 1_176 },
      { memberId: otherId, allocatedCents: 1_175 },
    ],
    ...overrides,
  };
}

describe("getExpenseDraftReadiness", () => {
  it("reports a complete draft as ready", () => {
    expect(getExpenseDraftReadiness(draft())).toEqual({ ready: true });
  });

  it("blocks on the amount before anything else", () => {
    expect(getExpenseDraftReadiness(draft({ amountCents: null }))).toEqual({
      ready: false,
      blocker: "amount",
    });
  });

  it("blocks on the payer when the amount is known", () => {
    expect(getExpenseDraftReadiness(draft({ payerMemberId: null }))).toEqual({
      ready: false,
      blocker: "payer",
    });
  });

  it("blocks on the member set when the household is not a pair", () => {
    expect(
      getExpenseDraftReadiness(
        draft({ memberIds: [payerId, otherId, "user-3"] }),
      ),
    ).toEqual({ ready: false, blocker: "members" });
  });

  it("blocks on the split when allocations do not reconcile", () => {
    expect(
      getExpenseDraftReadiness(
        draft({
          proposedAllocations: [
            { memberId: payerId, allocatedCents: 1_000 },
            { memberId: otherId, allocatedCents: 1_000 },
          ],
        }),
      ),
    ).toEqual({ ready: false, blocker: "split" });
  });

  it("blocks on the split when allocations are malformed", () => {
    expect(
      getExpenseDraftReadiness(draft({ proposedAllocations: "equal" })),
    ).toEqual({ ready: false, blocker: "split" });
  });

  it("stays ready for every equal split of a safe integer amount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (amountCents) => {
          const allocations = allocateEqualExpense(
            amountCents,
            asMemberId(payerId),
            asMemberId(otherId),
          );
          expect(
            getExpenseDraftReadiness(
              draft({ amountCents, proposedAllocations: allocations }),
            ),
          ).toEqual({ ready: true });
        },
      ),
    );
  });
});

describe("isExpenseDraftReady", () => {
  it("keeps the boolean contract its existing callers depend on", () => {
    expect(isExpenseDraftReady(draft())).toBe(true);
    expect(isExpenseDraftReady(draft({ amountCents: null }))).toBe(false);
  });
});
