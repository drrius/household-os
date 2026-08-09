import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { allocateEqualExpense, deriveMemberBalances } from "./money";

describe("allocateEqualExpense", () => {
  it("assigns an odd-cent remainder to the payer", () => {
    expect(allocateEqualExpense(1_001, "payer", "other")).toEqual([
      { memberId: "payer", allocatedCents: 501 },
      { memberId: "other", allocatedCents: 500 },
    ]);
  });

  it("always allocates the exact expense amount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (amount) => {
          const allocations = allocateEqualExpense(amount, "payer", "other");
          const total = allocations.reduce(
            (sum, allocation) => sum + allocation.allocatedCents,
            0,
          );

          expect(total).toBe(amount);
          expect(allocations[0]?.allocatedCents).toBeGreaterThanOrEqual(
            allocations[1]?.allocatedCents ?? 0,
          );
        },
      ),
    );
  });
});

describe("deriveMemberBalances", () => {
  it("derives balances without storing an editable total", () => {
    const balances = deriveMemberBalances([
      { memberId: "payer", receivableDeltaCents: 500 },
      { memberId: "other", receivableDeltaCents: -500 },
    ]);

    expect(balances.get("payer")).toBe(500);
    expect(balances.get("other")).toBe(-500);
  });
});
