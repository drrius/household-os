import { describe, expect, it } from "vitest";
import { isShoppingReceipt } from "./receipt-path";
const home = "10000000-0000-4000-8000-000000000071";
const file = "40000000-0000-4000-8000-000000000071";
describe("shopping receipt purpose", () => {
  it.each(["jpg", "png", "webp", "pdf"])(
    "accepts household receipts of supported %s type",
    (extension) => {
      expect(
        isShoppingReceipt(`${home}/receipts/${file}.${extension}`, home),
      ).toBe(true);
    },
  );
  it.each([
    `${home}/documents/${file}.pdf`,
    `${home}/completions/${file}.jpg`,
    `${home}/receipts/../documents/${file}.pdf`,
    `${home}/receipts%2f${file}.jpg`,
    `${home}/receipts/${file}.svg`,
    `20000000-0000-4000-8000-000000000071/receipts/${file}.jpg`,
    "https://example.invalid/receipt.pdf",
  ])("rejects nonreceipt path %s", (path) => {
    expect(isShoppingReceipt(path, home)).toBe(false);
  });
});
