import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { validateExactAllocations } from "./allocations";
import {
  formatCentimesField,
  parseChfToCentimes,
  parseChfToCentimesOrNull,
  reconcileShares,
  sharesBalance,
} from "./chf";
import { asMemberId } from "./values";

const payerId = asMemberId("11111111-1111-4111-8111-111111111111");
const otherId = asMemberId("22222222-2222-4222-8222-222222222222");
const maxCentimes = 999_999_999_999_999;

describe("parseChfToCentimes", () => {
  it("reads francs, one decimal and Swiss comma input as centimes", () => {
    expect(parseChfToCentimes("12")).toBe(1200);
    expect(parseChfToCentimes("12.3")).toBe(1230);
    expect(parseChfToCentimes("12,34")).toBe(1234);
    expect(parseChfToCentimes("  0.05  ")).toBe(5);
  });

  it("rejects anything the ledger could not store exactly", () => {
    expect(() => parseChfToCentimes("12.345")).toThrow(/two decimal/);
    expect(() => parseChfToCentimes("abc")).toThrow(/two decimal/);
    expect(() => parseChfToCentimes("")).toThrow(/two decimal/);
    expect(() => parseChfToCentimes("-1.00")).toThrow(/two decimal/);
    expect(() => parseChfToCentimes("99999999999999")).toThrow(/two decimal/);
  });

  it("returns null instead of throwing for a half-typed amount", () => {
    expect(parseChfToCentimesOrNull("12.")).toBeNull();
    expect(parseChfToCentimesOrNull("12.34")).toBe(1234);
  });

  it("round-trips every storable centime amount through the field format", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: maxCentimes }), (centimes) => {
        expect(parseChfToCentimes(formatCentimesField(centimes))).toBe(
          centimes,
        );
      }),
    );
  });

  it("reads a comma exactly like a decimal point", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: maxCentimes }), (centimes) => {
        const field = formatCentimesField(centimes);
        expect(parseChfToCentimes(field.replace(".", ","))).toBe(
          parseChfToCentimes(field),
        );
      }),
    );
  });

  it("never accepts more than two decimals and never leaves safe integers", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: maxCentimes }),
        fc.integer({ min: 1, max: 9 }),
        (centimes, extraDigit) => {
          const field = formatCentimesField(centimes);
          expect(() => parseChfToCentimes(`${field}${extraDigit}`)).toThrow(
            /two decimal/,
          );
          expect(Number.isSafeInteger(parseChfToCentimes(field))).toBe(true);
        },
      ),
    );
  });
});

describe("reconcileShares", () => {
  it("reports the running total while a share is still blank", () => {
    expect(reconcileShares("12.00", ["10.00", ""])).toEqual({
      amountCents: 1200,
      differenceCents: -200,
      filledShareCount: 1,
      shareCount: 2,
      sharesCents: 1000,
    });
  });

  it("reports how far a complete split is short of or over the amount", () => {
    expect(reconcileShares("12.00", ["10.00", "0.00"])?.differenceCents).toBe(
      -200,
    );
    expect(reconcileShares("12.00", ["10.00", "4.00"])?.differenceCents).toBe(
      200,
    );
    expect(sharesBalance(reconcileShares("12.00", ["7.00", "5.00"]))).toBe(
      true,
    );
  });

  it("cannot be read when the amount or a filled share is not CHF", () => {
    expect(reconcileShares("abc", ["7.00", "5.00"])).toBeNull();
    expect(reconcileShares("12.00", ["7.00", "5x"])).toBeNull();
    expect(sharesBalance(null)).toBe(false);
  });

  it("treats a partly filled split as unbalanced even when it sums correctly", () => {
    expect(sharesBalance(reconcileShares("0.00", ["0.00", ""]))).toBe(false);
  });

  it("agrees with the server rule for every pair of shares", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.integer({ min: 0, max: 10_000_000 }),
        fc.boolean(),
        (amountCents, rawShare, balanced) => {
          // Half the runs are exact complements, so both verdicts are exercised.
          const payerCents = rawShare % (amountCents + 1);
          const otherCents = balanced ? amountCents - payerCents : rawShare;
          const browser = sharesBalance(
            reconcileShares(formatCentimesField(amountCents), [
              formatCentimesField(payerCents),
              formatCentimesField(otherCents),
            ]),
          );
          const server = validateExactAllocations(
            amountCents,
            payerId,
            otherId,
            [
              { memberId: payerId, allocatedCents: payerCents },
              { memberId: otherId, allocatedCents: otherCents },
            ],
          ).ok;
          expect(browser).toBe(server);
        },
      ),
    );
  });

  it("keeps every reported total in safe integer centimes", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: maxCentimes }),
        fc.integer({ min: 0, max: maxCentimes }),
        fc.integer({ min: 0, max: maxCentimes }),
        (amountCents, payerCents, otherCents) => {
          const reconciliation = reconcileShares(
            formatCentimesField(amountCents),
            [formatCentimesField(payerCents), formatCentimesField(otherCents)],
          );
          expect(reconciliation).not.toBeNull();
          expect(Number.isSafeInteger(reconciliation?.sharesCents)).toBe(true);
          expect(Number.isSafeInteger(reconciliation?.differenceCents)).toBe(
            true,
          );
        },
      ),
    );
  });
});
