import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { formatCentimesAsFrancs } from "./franc-display";

describe("formatCentimesAsFrancs", () => {
  it.each([
    [0, "CHF 0.00"],
    [1, "CHF 0.01"],
    [2_350, "CHF 23.50"],
    [-1_240, "-CHF 12.40"],
    [100, "CHF 1.00"],
  ])("formats %i centimes as %s", (centimes, expected) => {
    expect(formatCentimesAsFrancs(centimes)).toBe(expected);
  });

  it("round-trips every safe integer through its decimal digits", () => {
    fc.assert(
      fc.property(
        fc.integer({
          min: Number.MIN_SAFE_INTEGER,
          max: Number.MAX_SAFE_INTEGER,
        }),
        (centimes) => {
          const formatted = formatCentimesAsFrancs(centimes);
          const decimalDigits = formatted
            .replace(/^-?CHF /, "")
            .replace(".", "");

          expect(formatted.startsWith("-")).toBe(centimes < 0);
          expect(formatted).toMatch(/^-?CHF \d+\.\d{2}$/);
          expect(BigInt(decimalDigits)).toBe(BigInt(Math.abs(centimes)));
        },
      ),
    );
  });

  it.each([1.5, Number.MAX_SAFE_INTEGER + 1, Number.NaN])(
    "rejects invalid centime value %s",
    (centimes) => {
      expect(() => formatCentimesAsFrancs(centimes)).toThrow(
        "Centimes must be a safe integer",
      );
    },
  );
});
