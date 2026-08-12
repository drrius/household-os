import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { settlementAmount } from "./settlements";

describe("settlementAmount", () => {
  it("uses the complete outstanding balance for a full settlement", () => {
    expect(
      settlementAmount({
        outstandingCents: 2_345,
        mode: "full",
        requestedCents: null,
      }),
    ).toBe(2_345);
  });

  it("rejects a partial settlement above the outstanding balance", () => {
    expect(() =>
      settlementAmount({
        outstandingCents: 2_345,
        mode: "partial",
        requestedCents: 2_346,
      }),
    ).toThrow(/within the current balance/);
  });

  it("never lets a valid partial settlement flip the balance", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000_000 }),
        fc.integer({ min: 1, max: 1_000_000_000 }),
        (outstanding, requested) => {
          const bounded = (requested % outstanding) + 1;
          const amount = settlementAmount({
            outstandingCents: outstanding,
            mode: "partial",
            requestedCents: bounded,
          });
          expect(amount).toBeGreaterThan(0);
          expect(outstanding - amount).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });
});
