import { describe, expect, it } from "vitest";

import { SURFACE_INVALIDATION_MAP, surfacesForTableChange } from "./surfaces";
import type { WatchedTable } from "./types";

const WATCHED_TABLES = [
  "areas",
  "pets",
  "inbox_notifications",
  "routine_occurrences",
  "routines",
  "meal_plan_entries",
  "meal_definitions",
  "meal_grocery_templates",
  "grocery_items",
  "grocery_categories",
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
    ["areas", ["home", "today"]],
    ["pets", ["home", "today"]],
    ["inbox_notifications", ["inbox", "today"]],
    ["routine_occurrences", ["today", "home", "plan"]],
    ["routines", ["today", "home", "plan"]],
    ["meal_plan_entries", ["plan", "today"]],
    ["meal_definitions", ["plan"]],
    ["meal_grocery_templates", ["plan"]],
    ["grocery_items", ["groceries", "today"]],
    ["shopping_sessions", ["groceries", "today"]],
    ["expense_drafts", ["money", "today", "groceries"]],
    ["financial_events", ["money", "today"]],
    ["activity_events", ["home"]],
  ] as const)("maps %s changes to the expected surfaces", (table, surfaces) => {
    expect(surfacesForTableChange(table)).toEqual(surfaces);
  });
});
