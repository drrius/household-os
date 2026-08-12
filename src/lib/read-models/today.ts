import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { addCivilDays, zurichCivilDate } from "@/lib/ui/zurich-date";
import {
  mapTodaySnapshot,
  type CompletionSource,
  type DraftSource,
  type LedgerSource,
  type MealSource,
  type MemberSource,
  type RoutineSource,
  type ShoppingSessionSource,
  type TodayReadSnapshot,
  type TodayViewModel,
} from "@/ui/today/today-view-model";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

function rows<T>(value: unknown, label: string): readonly T[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} query returned an unexpected payload`);
  }
  return value as T[];
}

function throwIfQueryFailed(
  label: string,
  error: { message: string } | null,
): void {
  if (error !== null) {
    throw new Error(`${label} query failed: ${error.message}`);
  }
}

async function loadMembers(
  supabase: ServerClient,
  householdId: string,
): Promise<readonly MemberSource[]> {
  const result = await supabase
    .from("household_members")
    .select("user_id, display_name")
    .eq("household_id", householdId);
  throwIfQueryFailed("Household members", result.error);
  return rows<MemberSource>(result.data, "Household members");
}

async function loadRoutines(
  supabase: ServerClient,
  householdId: string,
  civilDate: string,
): Promise<Pick<TodayReadSnapshot, "openOccurrences" | "completionsToday">> {
  const [open, completions] = await Promise.all([
    supabase
      .from("routine_occurrences")
      .select(
        "id, due_date, planned_assignee_id, meal_plan_entry_id, routine:routines!inner(title, priority)",
      )
      .eq("household_id", householdId)
      .eq("status", "open")
      .eq("role", "current")
      .lte("due_date", civilDate),
    supabase
      .from("routine_completions")
      .select(
        "completed_at, completed_by_member_id, occurrence:routine_occurrences!inner(id, due_date, planned_assignee_id, meal_plan_entry_id, routine:routines!inner(title, priority))",
      )
      .eq("household_id", householdId)
      .eq("completed_on", civilDate)
      .order("completed_at"),
  ]);
  throwIfQueryFailed("Open routines", open.error);
  throwIfQueryFailed("Routine completions", completions.error);
  return {
    openOccurrences: rows<RoutineSource>(open.data, "Open routines"),
    completionsToday: rows<CompletionSource>(
      completions.data,
      "Routine completions",
    ),
  };
}

async function loadMeals(
  supabase: ServerClient,
  householdId: string,
  civilDate: string,
): Promise<readonly MealSource[]> {
  const result = await supabase
    .from("meal_plan_entries")
    .select("id, date, slot, title_snapshot")
    .eq("household_id", householdId)
    .in("date", [civilDate, addCivilDays(civilDate, 1)])
    .is("removed_at", null)
    .not("slot", "is", null)
    .order("date")
    .order("slot");
  throwIfQueryFailed("Meals", result.error);
  return rows<MealSource>(result.data, "Meals");
}

async function loadShopping(
  supabase: ServerClient,
  householdId: string,
): Promise<Pick<TodayReadSnapshot, "activeGroceryCount" | "shoppingSessions">> {
  const [groceries, sessions] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .in("state", ["active", "claimed"]),
    supabase
      .from("shopping_sessions")
      .select("member_id")
      .eq("household_id", householdId)
      .is("finished_at", null),
  ]);
  throwIfQueryFailed("Groceries", groceries.error);
  throwIfQueryFailed("Shopping sessions", sessions.error);
  return {
    activeGroceryCount: groceries.count ?? 0,
    shoppingSessions: rows<ShoppingSessionSource>(
      sessions.data,
      "Shopping sessions",
    ),
  };
}

async function loadDrafts(
  supabase: ServerClient,
  householdId: string,
): Promise<readonly DraftSource[]> {
  const result = await supabase
    .from("expense_drafts")
    .select(
      "id, source_kind, description, amount_cents, payer_member_id, proposed_allocations",
    )
    .eq("household_id", householdId)
    .eq("status", "pending")
    .order("occurred_on");
  throwIfQueryFailed("Expense drafts", result.error);
  return rows<DraftSource>(result.data, "Expense drafts");
}

async function loadLedger(
  supabase: ServerClient,
  householdId: string,
): Promise<readonly LedgerSource[]> {
  const result = await supabase
    .from("ledger_entries")
    .select("financial_event_id, member_id, receivable_delta_cents")
    .eq("household_id", householdId);
  throwIfQueryFailed("Ledger entries", result.error);
  return rows<LedgerSource>(result.data, "Ledger entries");
}

export async function loadTodayViewModel(): Promise<TodayViewModel> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const civilDate = zurichCivilDate();
  const [members, routines, meals, shopping, drafts, ledgerEntries] =
    await Promise.all([
      loadMembers(supabase, member.householdId),
      loadRoutines(supabase, member.householdId, civilDate),
      loadMeals(supabase, member.householdId, civilDate),
      loadShopping(supabase, member.householdId),
      loadDrafts(supabase, member.householdId),
      loadLedger(supabase, member.householdId),
    ]);
  return mapTodaySnapshot({
    householdId: member.householdId,
    viewerUserId: member.userId,
    greetingName: member.displayName,
    civilDate,
    members,
    ...routines,
    meals,
    ...shopping,
    drafts,
    ledgerEntries,
  });
}
