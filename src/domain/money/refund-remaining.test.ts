import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  allocateProportionalRefund,
  remainingRefundShares,
} from "@/domain/money/refund-remaining";

const shares = (first: number, second: number) => [
  { memberId: "a", allocatedCents: first },
  { memberId: "b", allocatedCents: second },
];
describe("refund allocations", () => {
  it("uses integer proportions and returns every cent on a full refund", () => {
    expect(allocateProportionalRefund(5, shares(7, 3))).toEqual(shares(3, 2));
    expect(allocateProportionalRefund(1001, shares(501, 500))).toEqual(
      shares(501, 500),
    );
    expect(allocateProportionalRefund(4, shares(0, 7))).toEqual(shares(0, 4));
  });
  it("subtracts active refund shares and rejects over-refunding", () => {
    expect(
      remainingRefundShares(shares(501, 500), [
        ...shares(1, 2),
        ...shares(200, 100),
      ]),
    ).toEqual(shares(300, 398));
    expect(() => remainingRefundShares(shares(1, 2), shares(2, 0))).toThrow();
    for (const amount of [0, -1, 11, 1.5, NaN, Infinity])
      expect(() => allocateProportionalRefund(amount, shares(7, 3))).toThrow();
  });
  it("always preserves totals and stays within each remaining share at safe-integer boundaries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        fc.integer({ min: 0, max: Number.MAX_SAFE_INTEGER }),
        fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
        (first, second, requested) => {
          const total = BigInt(first) + BigInt(second);
          fc.pre(total > 0n);
          const amount = Number(
            BigInt(requested) < total ? BigInt(requested) : total,
          );
          const result = allocateProportionalRefund(
            amount,
            shares(first, second),
          );
          expect(
            result.reduce((sum, row) => sum + BigInt(row.allocatedCents), 0n),
          ).toBe(BigInt(amount));
          result.forEach((row, index) => {
            expect(Number.isSafeInteger(row.allocatedCents)).toBe(true);
            expect(row.allocatedCents).toBeGreaterThanOrEqual(0);
            expect(row.allocatedCents).toBeLessThanOrEqual(
              index === 0 ? first : second,
            );
          });
          const remaining = remainingRefundShares(
            shares(first, second),
            result,
          );
          expect(
            remaining.reduce(
              (sum, row) => sum + BigInt(row.allocatedCents),
              0n,
            ),
          ).toBe(total - BigInt(amount));
        },
      ),
      { numRuns: 1000 },
    );
  });
});
