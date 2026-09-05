import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  addCivilDays,
  startOfZurichWeek,
  zurichCivilDate,
} from "@/lib/ui/zurich-date";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Alphabetical cap on the meal library read; truncation is flagged. */
const MEAL_LIBRARY_LIMIT = 200;

export function requireRows<T>(
  label: string,
  result: { data: unknown; error: { message: string } | null },
): readonly T[] {
  if (result.error !== null) {
    throw new Error(`${label} query failed: ${result.error.message}`);
  }
  if (!Array.isArray(result.data)) {
    throw new Error(`${label} query returned an unexpected payload`);
  }
  return result.data as T[];
}

export async function memberDirectory(
  supabase: ServerClient,
  householdId: string,
): Promise<readonly { user_id: string; display_name: string }[]> {
  const result = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", householdId)
    .order("joined_at");
  return requireRows("members", result);
}

export async function readTodayOverview(): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const today = zurichCivilDate();
  const [members, occurrences, completions, meals, drafts] = await Promise.all([
    memberDirectory(supabase, member.householdId),
    supabase
      .from("routine_occurrences")
      .select(
        "id, due_date, planned_assignee_id, meal_plan_entry_id, routine:routines!inner(id, title, priority)",
      )
      .eq("household_id", member.householdId)
      .eq("status", "open")
      .eq("role", "current")
      .lte("due_date", addCivilDays(today, 1))
      .order("due_date"),
    supabase
      .from("routine_completions")
      .select(
        "completed_by_member_id, occurrence:routine_occurrences!inner(routine:routines!inner(title))",
      )
      .eq("household_id", member.householdId)
      .eq("completed_on", today),
    supabase
      .from("meal_plan_entries")
      .select("id, slot, title_snapshot")
      .eq("household_id", member.householdId)
      .eq("date", today)
      .is("removed_at", null),
    supabase
      .from("expense_drafts")
      .select("id, source_kind, description, amount_cents, occurred_on")
      .eq("household_id", member.householdId)
      .eq("status", "pending"),
  ]);
  // The query reaches one day ahead only so meal preparations for tomorrow
  // surface (matching the Today view); ordinary routines due tomorrow are
  // not "due today" and are filtered back out.
  const openRows = requireRows<{
    due_date: string;
    meal_plan_entry_id: string | null;
  }>("open occurrences", occurrences);
  return {
    today,
    viewerMemberId: member.userId,
    members,
    openOccurrences: openRows.filter(
      (row) => row.due_date <= today || row.meal_plan_entry_id !== null,
    ),
    completedToday: requireRows("completions", completions),
    mealsToday: requireRows("meals today", meals),
    pendingExpenseDrafts: requireRows("expense drafts", drafts),
  };
}

export async function readRoutines(input: {
  includeArchived: boolean;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  let routineQuery = supabase
    .from("routines")
    .select(
      "id, title, instructions, area_id, pet_id, assignment_policy, assigned_member_id, rotation_anchor_member_id, schedule_kind, schedule_rule, priority, active_from, active_until, paused_at, archived_at, updated_at",
    )
    .eq("household_id", member.householdId)
    .order("title");
  if (!input.includeArchived) {
    routineQuery = routineQuery.is("archived_at", null);
  }
  const [routines, occurrences] = await Promise.all([
    routineQuery,
    supabase
      .from("routine_occurrences")
      .select("id, routine_id, due_date, planned_assignee_id")
      .eq("household_id", member.householdId)
      .eq("status", "open")
      .eq("role", "current"),
  ]);
  return {
    routines: requireRows("routines", routines),
    currentOpenOccurrences: requireRows("open occurrences", occurrences),
  };
}

export async function readWeekPlan(input: {
  weekOf?: string;
  librarySearch?: string;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const weekStart = startOfZurichWeek(input.weekOf ?? zurichCivilDate());
  const weekEnd = addCivilDays(weekStart, 6);
  let libraryQuery = supabase
    .from("meal_definitions")
    .select("id, name")
    .eq("household_id", member.householdId)
    .is("archived_at", null)
    .order("name")
    // One extra row so truncation is detectable rather than silent.
    .limit(MEAL_LIBRARY_LIMIT + 1);
  if (input.librarySearch !== undefined) {
    const term = input.librarySearch.replaceAll(/[\\%_]/g, "\\$&");
    libraryQuery = libraryQuery.ilike("name", `%${term}%`);
  }
  const [entries, library] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select(
        "id, date, slot, title_snapshot, meal_definition_id, leftover_of_entry_id, recipe_url_snapshot, notes",
      )
      .eq("household_id", member.householdId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .is("removed_at", null)
      .order("date"),
    libraryQuery,
  ]);
  const libraryRows = requireRows("meal library", library);
  return {
    weekStart,
    weekEnd,
    entries: requireRows("meal plan entries", entries),
    mealLibrary: libraryRows.slice(0, MEAL_LIBRARY_LIMIT),
    mealLibraryTruncated: libraryRows.length > MEAL_LIBRARY_LIMIT,
  };
}

export async function readGroceryList(): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [items, categories, sessions] = await Promise.all([
    supabase
      .from("grocery_items")
      .select(
        "id, name, quantity, unit, category_id, note, state, claimed_by_session_id",
      )
      .eq("household_id", member.householdId)
      .in("state", ["active", "claimed"])
      .order("sort_order"),
    supabase
      .from("grocery_categories")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("shopping_sessions")
      .select("id, member_id, started_at")
      .eq("household_id", member.householdId)
      .is("finished_at", null),
  ]);
  return {
    viewerMemberId: member.userId,
    items: requireRows("grocery items", items),
    categories: requireRows("grocery categories", categories),
    activeShoppingSessions: requireRows("shopping sessions", sessions),
  };
}

export async function readHousehold(): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [
    household,
    members,
    areas,
    pets,
    groceryCategories,
    expenseCategories,
  ] = await Promise.all([
    supabase
      .from("households")
      .select("name")
      .eq("id", member.householdId)
      .single(),
    memberDirectory(supabase, member.householdId),
    supabase
      .from("areas")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("pets")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("grocery_categories")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
  ]);
  if (household.error !== null) {
    throw new Error(`household query failed: ${household.error.message}`);
  }
  return {
    householdName: (household.data as { name: string }).name,
    viewerMemberId: member.userId,
    members: members.map((row) => ({
      memberId: row.user_id,
      name: row.display_name,
      isViewer: row.user_id === member.userId,
    })),
    areas: requireRows("areas", areas),
    pets: requireRows("pets", pets),
    groceryCategories: requireRows("grocery categories", groceryCategories),
    expenseCategories: requireRows("expense categories", expenseCategories),
  };
}
