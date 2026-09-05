import type { AppSurface, WatchedTable } from "./types";

export const SURFACE_INVALIDATION_MAP = {
  areas: ["home", "today"],
  pets: ["home", "today"],
  inbox_notifications: ["inbox", "today"],
  routine_occurrences: ["today", "home", "plan"],
  routines: ["today", "home", "plan"],
  meal_plan_entries: ["plan", "today"],
  meal_definitions: ["plan"],
  meal_grocery_templates: ["plan"],
  grocery_items: ["groceries", "today"],
  shopping_sessions: ["groceries", "today"],
  expense_drafts: ["money", "today"],
  financial_events: ["money", "today", "plan", "home"],
  activity_events: ["home"],
  household_projects: ["plan", "today", "home"],
  project_tasks: ["plan", "today"],
  calendar_events: ["plan", "today"],
  trip_bookings: ["plan", "today"],
  household_contacts: ["home"],
  household_assets: ["home", "today"],
  household_commitments: ["home", "today", "money"],
  household_decisions: ["home", "plan"],
  decision_options: ["home", "plan"],
  household_financial_links: ["money", "plan", "home"],
  household_documents: ["home", "plan", "money"],
  asset_maintenance: ["home"],
  asset_routines: ["home", "today"],
  grocery_categories: ["groceries", "plan"],
} as const satisfies Readonly<Record<WatchedTable, readonly AppSurface[]>>;

export function surfacesForTableChange(
  table: WatchedTable,
): readonly AppSurface[] {
  return SURFACE_INVALIDATION_MAP[table];
}
