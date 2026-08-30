import "server-only";

import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import type { LedgerEntry } from "@/domain/money/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  addCivilDays,
  startOfZurichWeek,
  zurichCivilDate,
} from "@/lib/ui/zurich-date";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function requireRows<T>(
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

async function memberDirectory(
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
  return {
    today,
    viewerMemberId: member.userId,
    members,
    openOccurrences: requireRows("open occurrences", occurrences),
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
      "id, title, instructions, area_id, pet_id, assignment_policy, assigned_member_id, rotation_anchor_member_id, schedule_kind, schedule_rule, priority, active_from, active_until, paused_at, archived_at",
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
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const weekStart = startOfZurichWeek(input.weekOf ?? zurichCivilDate());
  const weekEnd = addCivilDays(weekStart, 6);
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
    supabase
      .from("meal_definitions")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("name")
      .limit(100),
  ]);
  return {
    weekStart,
    weekEnd,
    entries: requireRows("meal plan entries", entries),
    mealLibrary: requireRows("meal library", library),
  };
}

export async function readGroceryList(): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [items, categories, sessions] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id, name, quantity, unit, category_id, note, state")
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

export async function readMoneyOverview(): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [members, ledger, events, drafts, rules] = await Promise.all([
    memberDirectory(supabase, member.householdId),
    supabase
      .from("ledger_entries")
      .select("financial_event_id, member_id, receivable_delta_cents")
      .eq("household_id", member.householdId),
    supabase
      .from("financial_events")
      .select(
        "id, type, occurred_on, description, amount_cents, payer_member_id, related_event_id",
      )
      .eq("household_id", member.householdId)
      .order("occurred_on", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("expense_drafts")
      .select(
        "id, source_kind, description, amount_cents, occurred_on, payer_member_id, proposed_allocations",
      )
      .eq("household_id", member.householdId)
      .eq("status", "pending"),
    supabase
      .from("recurring_expense_rules")
      .select(
        "id, description, amount_cents, payer_member_id, schedule_kind, iso_weekday, day_of_month, active, next_occurrence_on",
      )
      .eq("household_id", member.householdId)
      .order("description"),
  ]);
  const ledgerRows = requireRows<{
    financial_event_id: string;
    member_id: string;
    receivable_delta_cents: number;
  }>("ledger entries", ledger);
  const entries: LedgerEntry[] = ledgerRows.map((row) => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
  const balances = deriveMemberBalances(entries);
  const directory = members.map((row) => ({
    memberId: row.user_id,
    name: row.display_name,
    balanceCents: balances.get(asMemberId(row.user_id)) ?? 0,
  }));
  return {
    viewerMemberId: member.userId,
    balances: directory,
    balanceExplainer:
      "A positive balanceCents means that member is owed money; negative means they owe.",
    recentEvents: requireRows("financial events", events),
    pendingExpenseDrafts: requireRows("expense drafts", drafts),
    recurringExpenseRules: requireRows("recurring rules", rules),
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
