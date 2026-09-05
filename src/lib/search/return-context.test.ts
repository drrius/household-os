import { expect, it } from "vitest";
import fc from "fast-check";
import { parseSearchRequest, searchHref } from "@/domain/search/query";
import { searchResultWithContext, searchReturnHref } from "./return-context";
const id = "00000000-0000-4000-8000-000000000001";
it("retains search filters and continuation cursor through a booking destination", () => {
  const request = parseSearchRequest({
    q: "Lisbon flight",
    type: "trip",
    archived: "1",
    cursor: `100.booking.${id}`,
  });
  const result = searchResultWithContext(
    { kind: "booking", id, parent_id: id },
    request,
  );
  expect(new URL(result, "https://household.invalid").pathname).toBe(
    `/plan/projects/${id}/bookings/${id}`,
  );
  const origin = new URL(result, "https://household.invalid").searchParams.get(
    "fromSearch",
  );
  expect(searchReturnHref(origin)).toBe(searchHref(request, request.cursor));
});
it.each([
  "//outside.example/search?q=x",
  "/search?q=one&q=two",
  "/search?q=one&cursor=bad",
  "/search?q=one&type=unknown",
  "/home?q=one",
  "/search?q=one&redirect=/api/private",
  "/search?q=one#other",
  "/search?q=x",
  "/search?q=" + "x".repeat(121),
  null,
])("rejects unsafe or invalid return context %s", (value) =>
  expect(searchReturnHref(value)).toBeNull(),
);
it("never creates another origin from arbitrary search context", () => {
  fc.assert(
    fc.property(fc.string(), (value) => {
      const href = searchReturnHref(value);
      if (href) {
        const url = new URL(href, "https://household.invalid");
        expect(url.origin).toBe("https://household.invalid");
        expect(url.pathname).toBe("/search");
      }
    }),
  );
});
