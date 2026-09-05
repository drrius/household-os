import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { formatCentimesAsFrancs } from "./franc-display";
describe("exact paid-cost formatting", () => {
  it("preserves centimes beyond the JavaScript safe-integer range", () => {
    expect(formatCentimesAsFrancs(18014398509481982n)).toBe(
      "CHF 180143985094819.82",
    );
    expect(formatCentimesAsFrancs(-1n)).toBe("-CHF 0.01");
    expect(formatCentimesAsFrancs(0n)).toBe("CHF 0.00");
    expect(() => formatCentimesAsFrancs(Number.MAX_SAFE_INTEGER + 1)).toThrow();
  });
  it("round trips every generated signed centime without floating point", () => {
    fc.assert(
      fc.property(
        fc.bigInt({ min: -(10n ** 40n), max: 10n ** 40n }),
        (amount) => {
          const result = formatCentimesAsFrancs(amount);
          const [, sign, whole, fraction] = /^(-?)CHF (\d+)\.(\d{2})$/.exec(
            result,
          )!;
          expect(
            (BigInt(whole!) * 100n + BigInt(fraction!)) * (sign ? -1n : 1n),
          ).toBe(amount);
        },
      ),
    );
  });
});
