import { describe, expect, it } from "vitest";

import { SURFACE_INVALIDATION_MAP, surfacesForTableChange } from "./surfaces";
import type { WatchedTable } from "./types";

const WATCHED_TABLES = [
  "inbox_notifications",
  "routine_occurrences",
  "routines",
  "meal_plan_entries",
  "grocery_items",
  "shopping_sessions",
  "expense_drafts",
  "financial_events",
  "activity_events",
] as const satisfies readonly WatchedTable[];

describe("SURFACE_INVALIDATION_MAP", () => {
  it("covers every watched table exactly once", () => {
    expect(Object.keys(SURFACE_INVALIDATION_MAP).sort()).toEqual(
      [...WATCHED_TABLES].sort(),
    );
  });

  it.each([
    ["inbox_notifications", ["inbox", "today"]],
    ["routine_occurrences", ["today", "home"]],
    ["routines", ["today", "home"]],
    ["meal_plan_entries", ["plan", "today"]],
    ["grocery_items", ["groceries", "today"]],
    ["shopping_sessions", ["groceries", "today"]],
    ["expense_drafts", ["money", "today"]],
    ["financial_events", ["money"]],
    ["activity_events", ["home"]],
  ] as const)("maps %s changes to the expected surfaces", (table, surfaces) => {
    expect(surfacesForTableChange(table)).toEqual(surfaces);
  });
});
