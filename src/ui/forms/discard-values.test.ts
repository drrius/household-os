import { expect, it } from "vitest";
import { discardSnapshot, leavesCurrentDocument } from "./discard-values";

it("detects edited and reverted business values while ignoring form metadata", () => {
  const initial = [
    { name: "note", value: "Original" },
    { name: "area", value: "home" },
  ];
  const before = discardSnapshot(initial);
  expect(discardSnapshot([...initial].reverse())).toBe(before);
  expect(
    discardSnapshot([
      ...initial,
      { name: "idempotencyKey", value: "new key" },
      { name: "$ACTION_ID", value: "new action" },
    ]),
  ).toBe(before);
  expect(
    discardSnapshot([{ name: "note", value: "Edited" }, initial[1]!]),
  ).not.toBe(before);
  expect(discardSnapshot(initial)).toBe(before);
  expect(
    discardSnapshot([initial[0]!, { name: "area", value: "garden" }]),
  ).not.toBe(before);
});
it("compares repeated values without relying on DOM ordering", () => {
  const values = [
    { name: "days", value: "mon" },
    { name: "days", value: "fri" },
  ];
  expect(discardSnapshot(values)).toBe(discardSnapshot([...values].reverse()));
  expect(discardSnapshot(values.slice(1))).not.toBe(discardSnapshot(values));
});
it("only same-origin path or query changes leave the current form document", () => {
  const current = "https://household.example/home/routines/new?area=home";
  for (const href of [
    "#details",
    current,
    "https://other.example/",
    "mailto:person@example.invalid",
  ])
    expect(leavesCurrentDocument(href, current)).toBe(false);
  for (const href of ["/", "?area=garden", "/money"])
    expect(leavesCurrentDocument(href, current)).toBe(true);
});
