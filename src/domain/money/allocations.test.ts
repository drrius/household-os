import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { allocateEqualExpense, validateExactAllocations } from "./allocations";
import { asMemberId } from "./values";

const payerId = asMemberId("payer");
const otherId = asMemberId("other");

describe("allocateEqualExpense", () => {
  it("assigns an odd-cent remainder to the payer", () => {
    expect(allocateEqualExpense(1_001, payerId, otherId)).toEqual([
      { memberId: payerId, allocatedCents: 501 },
      { memberId: otherId, allocatedCents: 500 },
    ]);
  });

  it("always allocates the exact amount", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        (amountCents) => {
          const allocations = allocateEqualExpense(
            amountCents,
            payerId,
            otherId,
          );
          const total = allocations.reduce(
            (sum, allocation) => sum + allocation.allocatedCents,
            0,
          );
          expect(total).toBe(amountCents);
        },
      ),
    );
  });

  it.each([-1, 1.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects invalid amount %s",
    (amountCents) => {
      expect(() =>
        allocateEqualExpense(amountCents, payerId, otherId),
      ).toThrow();
    },
  );
});

describe("validateExactAllocations", () => {
  it("accepts exactly the two household members summing to the amount", () => {
    expect(
      validateExactAllocations(1_000, payerId, otherId, [
        { memberId: otherId, allocatedCents: 400 },
        { memberId: payerId, allocatedCents: 600 },
      ]),
    ).toEqual({
      ok: true,
      allocations: [
        { memberId: payerId, allocatedCents: 600 },
        { memberId: otherId, allocatedCents: 400 },
      ],
    });
  });

  it("rejects missing members, duplicates, and mismatched sums", () => {
    expect(
      validateExactAllocations(1_000, payerId, otherId, [
        { memberId: payerId, allocatedCents: 500 },
      ]).ok,
    ).toBe(false);
    expect(
      validateExactAllocations(1_000, payerId, otherId, [
        { memberId: payerId, allocatedCents: 500 },
        { memberId: payerId, allocatedCents: 500 },
      ]),
    ).toMatchObject({
      ok: false,
      error: { code: "duplicate_member" },
    });
    expect(
      validateExactAllocations(1_000, payerId, otherId, [
        { memberId: payerId, allocatedCents: 499 },
        { memberId: otherId, allocatedCents: 500 },
      ]).ok,
    ).toBe(false);
  });
});
