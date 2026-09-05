import type { AppSurface, WatchedTable } from "./types";

export const SURFACE_INVALIDATION_MAP = {
  meal_definitions: ["plan", "search"],
  meal_grocery_templates: ["plan"],
  areas: ["home", "today", "search"],
  pets: ["home", "today", "search"],
  routine_completions: ["home", "today", "search"],
  expense_categories: ["money", "search"],
  inbox_notifications: ["inbox", "today"],
  routine_occurrences: ["today", "home", "plan", "search"],
  routines: ["today", "home", "plan", "search"],
  meal_plan_entries: ["plan", "today", "search"],
  grocery_items: ["groceries", "today", "search"],
  shopping_sessions: ["groceries", "today"],
  expense_drafts: ["money", "today", "groceries"],
  financial_events: ["money", "today", "plan", "home", "search"],
  activity_events: ["home"],
  household_projects: ["plan", "today", "home", "money", "search"],
  project_tasks: ["plan", "today", "search"],
  calendar_events: ["plan", "today", "search"],
  trip_bookings: ["plan", "today", "money", "search"],
  household_contacts: ["home", "search"],
  household_assets: ["home", "today", "money", "search"],
  household_commitments: ["home", "today", "money", "search"],
  household_decisions: ["home", "plan", "search"],
  decision_options: ["home", "plan", "search"],
  household_financial_links: ["money", "plan", "home"],
  household_documents: ["home", "plan", "money", "search"],
  asset_maintenance: ["home"],
  asset_routines: ["home", "today", "search"],
  grocery_categories: ["groceries", "plan", "search"],
} as const satisfies Readonly<Record<WatchedTable, readonly AppSurface[]>>;

export function surfacesForTableChange(
  table: WatchedTable,
): readonly AppSurface[] {
  return SURFACE_INVALIDATION_MAP[table];
}
