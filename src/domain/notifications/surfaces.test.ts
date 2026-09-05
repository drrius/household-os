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
  "household_projects",
  "project_tasks",
  "calendar_events",
  "trip_bookings",
  "household_contacts",
  "household_assets",
  "household_commitments",
  "household_decisions",
  "decision_options",
  "household_financial_links",
  "household_documents",
  "asset_maintenance",
  "asset_routines",
  "grocery_categories",
  "meal_definitions",
  "areas",
  "pets",
  "routine_completions",
  "expense_categories",
] as const satisfies readonly WatchedTable[];

describe("SURFACE_INVALIDATION_MAP", () => {
  it("covers every watched table exactly once", () => {
    expect(Object.keys(SURFACE_INVALIDATION_MAP).sort()).toEqual(
      [...WATCHED_TABLES].sort(),
    );
  });

  it.each([
    ["inbox_notifications", ["inbox", "today"]],
    ["routine_occurrences", ["today", "home", "plan", "search"]],
    ["routines", ["today", "home", "plan", "search"]],
    ["meal_plan_entries", ["plan", "today", "search"]],
    ["grocery_items", ["groceries", "today", "search"]],
    ["shopping_sessions", ["groceries", "today"]],
    ["expense_drafts", ["money", "today"]],
    ["financial_events", ["money", "today", "search"]],
    ["activity_events", ["home"]],
  ] as const)("maps %s changes to the expected surfaces", (table, surfaces) => {
    expect(surfacesForTableChange(table)).toEqual(surfaces);
  });
});

it.each([
  "routine_occurrences",
  "routines",
  "meal_plan_entries",
  "grocery_items",
  "financial_events",
  "household_projects",
  "project_tasks",
  "calendar_events",
  "trip_bookings",
  "household_contacts",
  "household_assets",
  "household_commitments",
  "household_decisions",
  "decision_options",
  "household_documents",
  "grocery_categories",
  "meal_definitions",
  "areas",
  "pets",
  "routine_completions",
  "expense_categories",
])("refreshes search when %s changes", (table) => {
  expect(surfacesForTableChange(table as WatchedTable)).toContain("search");
});
