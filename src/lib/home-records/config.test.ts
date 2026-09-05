import { expect, it } from "vitest";
import { safeRecordReturn } from "./config";
it("retains a local search context without accepting outside return URLs", () => {
  expect(
    safeRecordReturn(
      "/home/inventory?q=filter&page=2&attention=1",
      "/home/inventory",
    ),
  ).toBe("/home/inventory?q=filter&page=2&attention=1");
  for (const path of [
    "https://outside.example",
    "//outside.example",
    "javascript:alert(1)",
    "/api/attachments",
  ])
    expect(safeRecordReturn(path, "/home/inventory")).toBe("/home/inventory");
});
