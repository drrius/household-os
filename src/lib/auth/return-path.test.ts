import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { returnPathWithFragment, safeReturnPath } from "./return-path";

describe("post-authentication destination", () => {
  it.each([
    "/",
    "/security",
    "/search?q=Lisbon&type=trip&archived=1",
    "/home/inbox?unread=1",
    "/plan?week=2026-09-07&day=2026-09-09",
    "/money/events/123#history",
    "/groceries?search=bread%20and%20milk",
    "/home?search=50%25",
  ])("retains protected destination %s", (path) =>
    expect(safeReturnPath(path)).toBe(path),
  );
  it.each([
    undefined,
    null,
    ["/home"],
    "https://evil.invalid",
    "//evil.invalid",
    "\\\\evil.invalid",
    "/\\evil.invalid",
    "javascript:alert(1)",
    " /home",
    "/home\n",
    "/%2f%2fevil.invalid",
    "/%252f%252fevil.invalid",
    "/home/%2e%2e/sign-in",
    "/home/%252e%252e/auth/consume",
    "/home/%5cevil",
    "/home/%255cevil",
    "/sign-in?returnTo=/home",
    "/auth/consume",
    "/search/anything",
    "/api/attachments?path=private",
    "/_next/static/file",
    "/home?x=%0d%0aLocation:evil",
    "/home/%",
    "/home/" + "x".repeat(4096),
  ])("rejects unsafe or non-product destination %s", (path) =>
    expect(safeReturnPath(path)).toBe("/"),
  );
  it("retains inherited browser fragments without overwriting explicit destination fragments", () => {
    expect(
      returnPathWithFragment("/money/events/123?mode=full", "#history"),
    ).toBe("/money/events/123?mode=full#history");
    expect(
      returnPathWithFragment("/money/events/123#receipt", "#history"),
    ).toBe("/money/events/123#receipt");
    expect(returnPathWithFragment("/home", "//evil.invalid")).toBe("/home");
  });
  it("cannot turn arbitrary text into an external or authentication redirect", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const result = safeReturnPath(value);
        const destination = new URL(result, "https://household.invalid");
        expect(destination.origin).toBe("https://household.invalid");
        expect(result.startsWith("//")).toBe(false);
        expect(destination.pathname).toMatch(
          /^(?:\/(?:plan|groceries|money|home)(?:\/|$)|\/(?:security|search)\/?$|\/$)/u,
        );
      }),
    );
  });
});
it("preserves an encoded search continuation on a record through sign-in", () => {
  const search =
    "/search?q=Lisbon%20flight&type=trip&archived=1&cursor=100.booking.00000000-0000-4000-8000-000000000001";
  const detail = `/plan/projects/00000000-0000-4000-8000-000000000001?${new URLSearchParams({ fromSearch: search })}`;
  expect(safeReturnPath(detail)).toBe(detail);
  expect(safeReturnPath(search)).toBe(search);
});
