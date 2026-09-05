import { expect, it } from "vitest";
import fc from "fast-check";
import { withSearchReturn } from "./save-return";

it("keeps the existing destination, query and fragment with canonical search context", () => {
  const form = new FormData();
  form.set("searchReturn", "/search?q=Lisbon&type=trip&archived=1");
  const url = new URL(
    withSearchReturn("/plan?week=2026-09-07#tasks", form),
    "https://household.invalid",
  );
  expect(url.pathname).toBe("/plan");
  expect(url.searchParams.get("week")).toBe("2026-09-07");
  expect(url.hash).toBe("#tasks");
  expect(url.searchParams.get("fromSearch")).toBe(
    "/search?q=Lisbon&type=trip&archived=1",
  );
});
it("ignores missing, duplicated or forged search destinations", () => {
  const form = new FormData();
  expect(withSearchReturn("/groceries", form)).toBe("/groceries");
  form.set("searchReturn", "https://outside.invalid");
  expect(withSearchReturn("/groceries", form)).toBe("/groceries");
  form.set("searchReturn", "/search?q=milk");
  form.append("searchReturn", "/search?q=bread");
  expect(withSearchReturn("/groceries", form)).toBe("/groceries");
});
it("never changes a save destination origin or pathname for arbitrary submitted search input", () => {
  fc.assert(
    fc.property(fc.string(), (value) => {
      const form = new FormData();
      form.set("searchReturn", value);
      const url = new URL(
        withSearchReturn("/money/events/123", form),
        "https://household.invalid",
      );
      expect(url.origin).toBe("https://household.invalid");
      expect(url.pathname).toBe("/money/events/123");
    }),
  );
});
