import type { AppSurface, WatchedTable } from "./types";

export const SURFACE_INVALIDATION_MAP: {
  readonly [T in WatchedTable]: readonly AppSurface[];
} = {
  inbox_notifications: ["inbox", "today"],
  routine_occurrences: ["today", "home"],
  routines: ["today", "home"],
  meal_plan_entries: ["plan", "today"],
  grocery_items: ["groceries", "today"],
  shopping_sessions: ["groceries", "today"],
  expense_drafts: ["money", "today"],
  financial_events: ["money"],
  activity_events: ["home"],
};

export function surfacesForTableChange(
  table: WatchedTable,
): readonly AppSurface[] {
  return SURFACE_INVALIDATION_MAP[table];
}
