import type { AppSurface, WatchedTable } from "./types";

export const SURFACE_INVALIDATION_MAP = {
  inbox_notifications: ["inbox", "today"],
  routine_occurrences: ["today", "home"],
  routines: ["today", "home"],
  meal_plan_entries: ["plan", "today"],
  grocery_items: ["groceries", "today"],
  shopping_sessions: ["groceries", "today"],
  expense_drafts: ["money", "today"],
  financial_events: ["money", "today"],
  activity_events: ["home"],
} as const satisfies Readonly<Record<WatchedTable, readonly AppSurface[]>>;

export function surfacesForTableChange(
  table: WatchedTable,
): readonly AppSurface[] {
  return SURFACE_INVALIDATION_MAP[table];
}
