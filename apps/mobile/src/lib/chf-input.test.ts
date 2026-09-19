import { describe, expect, it } from "vitest";

import { parseChfToCentimes } from "./chf-input";

describe("parseChfToCentimes", () => {
  it("accepts the same amounts as the domain parser", () => {
    expect(parseChfToCentimes("12.40")).toBe(1240);
    expect(parseChfToCentimes("CHF 12,40")).toBe(1240);
    expect(parseChfToCentimes(" 0.05 ")).toBe(5);
  });

  it("rejects unsafe or malformed amounts before any RPC", () => {
    expect(parseChfToCentimes("abc")).toBeNull();
    expect(parseChfToCentimes("12.345")).toBeNull();
    expect(parseChfToCentimes("-1.00")).toBeNull();
    expect(parseChfToCentimes("90071992547409.93")).toBeNull();
  });
});
