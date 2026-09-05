import { expect, it } from "vitest";
import fc from "fast-check";
import {
  parseSearchRequest,
  searchCharacterCount,
  resultKinds,
  searchHref,
  searchResultHref,
} from "./query";
import { parseSearchPage } from "./results";
const id = "00000000-0000-4000-8000-000000000001",
  parent = "00000000-0000-4000-8000-000000000002";
it("normalizes whitespace and preserves filters and cursor in pagination links", () => {
  const request = parseSearchRequest({
    q: "  summer\n  holiday  ",
    type: "trip",
    archived: "1",
    cursor: `25.booking.${id}`,
  });
  expect(request).toMatchObject({
    q: "summer holiday",
    type: "trip",
    archived: true,
    error: null,
    cursor: { score: 25, kind: "booking", id },
  });
  expect(searchHref(request, request.cursor)).toBe(
    `/search?q=summer%20holiday&type=trip&archived=1&cursor=25.booking.${id}`,
  );
  expect(searchHref(request)).not.toContain("cursor=");
});
it.each([
  { q: "x".repeat(121) },
  { q: ["one", "two"] },
  { type: "__proto__" },
  { type: "constructor" },
  { type: "unknown" },
  { archived: "yes" },
  { cursor: `-1.trip.${id}` },
  { cursor: `1.evil.${id}` },
  { cursor: `1.trip.${id}.extra` },
  { cursor: `.trip.${id}` },
])("rejects invalid search input %j", (params) =>
  expect(parseSearchRequest(params).error).not.toBeNull(),
);
it("never turns query text into another URL or executable destination", () => {
  fc.assert(
    fc.property(fc.string(), (q) => {
      const href = searchHref({ q, type: "all", archived: false });
      expect(href.startsWith("/search?q=")).toBe(true);
      expect(href).not.toContain("\n");
      expect(decodeURIComponent(href.slice("/search?q=".length))).toBe(q);
    }),
  );
  expect(() =>
    searchHref(
      { q: "safe", type: "all", archived: false },
      null,
      "https://example.com",
    ),
  ).toThrow();
});
it("maps every result kind to an existing internal destination", () => {
  for (const kind of resultKinds) {
    const href = searchResultHref({ kind, id, parent_id: parent });
    expect(href).toMatch(/^\/(home|plan|groceries|money)\//u);
    expect(href).not.toContain("?");
  }
  expect(searchResultHref({ kind: "booking", id, parent_id: parent })).toBe(
    `/plan/projects/${parent}/bookings/${id}`,
  );
  expect(searchResultHref({ kind: "task", id, parent_id: parent })).toBe(
    `/plan/projects/${parent}/tasks/${id}`,
  );
});
it.each([
  "javascript:alert(1)",
  "../other",
  "x?redirect=https://example.com",
  "//example.com",
  "",
])("rejects untrusted IDs %s", (id) =>
  expect(() =>
    searchResultHref({ kind: "document", id, parent_id: null }),
  ).toThrow(),
);
it("rejects malformed RPC output before rendering links", () => {
  expect(() =>
    parseSearchPage({
      total_count: "1",
      results: [
        {
          kind: "task",
          id,
          parent_id: null,
          title: "Task",
          excerpt: "",
          status: "open",
          archived: false,
          date: null,
          score: 1,
        },
      ],
      next_cursor: null,
    }),
  ).toThrow();
  expect(() =>
    parseSearchPage({ total_count: 1, results: [], next_cursor: null }),
  ).toThrow();
});

it("counts request length in Unicode code points just like PostgreSQL", () => {
  expect(searchCharacterCount("😀")).toBe(1);
  expect(searchCharacterCount("😀a")).toBe(2);
  expect(parseSearchRequest({ q: "😀".repeat(120) }).error).toBeNull();
  expect(parseSearchRequest({ q: "😀".repeat(121) }).error).toMatch(/120/);
});
