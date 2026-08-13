import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  formatCentimesField,
  parseChfToCentimes,
  parseChfToCentimesOrNull,
} from "./chf";

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
