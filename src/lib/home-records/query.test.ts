import { expect, it } from "vitest";
import { normalizeRecordQuery } from "./query";
import { safeRecordReturn } from "./config";

it("uses the first repeated query value without comma-joining filters or return URLs", () => {
  const query = normalizeRecordQuery({
    q: ["washing machine", "fridge"],
    page: ["2", "100"],
    archived: ["1", "0"],
    attention: "1",
    back: ["/home/inventory?q=washer", "https://example.com"],
    saved: [],
  });
  expect(query).toEqual({
    q: "washing machine",
    page: "2",
    archived: "1",
    attention: "1",
    back: "/home/inventory?q=washer",
    saved: undefined,
  });
  expect(safeRecordReturn(query.back, "/home/inventory")).toBe(
    "/home/inventory?q=washer",
  );
});

it("does not turn an unsafe first return URL into an allowed later one", () => {
  const query = normalizeRecordQuery({
    back: ["https://example.com", "/home/inventory"],
  });
  expect(safeRecordReturn(query.back, "/home/contacts")).toBe("/home/contacts");
  expect(normalizeRecordQuery({ q: undefined })).toEqual({ q: undefined });
});
