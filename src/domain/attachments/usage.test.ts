import { expect, it } from "vitest";
import fc from "fast-check";
import { attachmentUsage, ATTACHMENT_WARNING_BYTES } from "./usage";
it("distinguishes zero, below, exact and above the decimal 500 MB threshold", () => {
  expect(attachmentUsage("0")).toEqual({
    status: "available",
    totalBytes: "0",
    usedLabel: "0 bytes",
    warning: false,
  });
  expect(attachmentUsage("499999999")).toMatchObject({
    usedLabel: "499.9 MB",
    warning: false,
  });
  expect(attachmentUsage("500000000")).toMatchObject({
    usedLabel: "500 MB",
    warning: true,
  });
  expect(attachmentUsage("500000001")).toMatchObject({ warning: true });
});
it("preserves decimal byte strings beyond JavaScript integer precision", () => {
  const bytes = "900719925474099312345";
  expect(attachmentUsage(bytes)).toMatchObject({
    status: "available",
    totalBytes: bytes,
    warning: true,
  });
  fc.assert(
    fc.property(fc.bigInt({ min: 0n, max: 10n ** 30n }), (bytes) => {
      const state = attachmentUsage(bytes.toString());
      expect(state).toMatchObject({
        totalBytes: bytes.toString(),
        warning: bytes >= ATTACHMENT_WARNING_BYTES,
      });
    }),
  );
});
it.each([
  null,
  undefined,
  0,
  500000000,
  "",
  "-1",
  "1.5",
  "1e9",
  "NaN",
  "01",
  {},
  [],
])("does not turn unknown or lossy usage %j into a safe total", (value) => {
  expect(attachmentUsage(value)).toEqual({ status: "unavailable" });
});
