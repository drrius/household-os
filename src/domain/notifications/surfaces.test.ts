import { describe, expect, it } from "vitest";

import { SURFACE_INVALIDATION_MAP, surfacesForTableChange } from "./surfaces";
import type { WatchedTable } from "./types";

const tables = Object.keys(SURFACE_INVALIDATION_MAP) as WatchedTable[];

describe("SURFACE_INVALIDATION_MAP", () => {
  it("covers every watched table", () => {
    expect(tables.sort()).toEqual(
      [
        "activity_events",
        "expense_drafts",
        "financial_events",
        "grocery_items",
        "inbox_notifications",
        "meal_plan_entries",
        "routine_occurrences",
        "routines",
        "shopping_sessions",
      ].sort(),
    );
  });

  it("maps inbox changes to inbox and today", () => {
    expect(surfacesForTableChange("inbox_notifications")).toEqual([
      "inbox",
      "today",
    ]);
  });

  it("maps financial events only to money", () => {
    expect(surfacesForTableChange("financial_events")).toEqual(["money"]);
  });
});
