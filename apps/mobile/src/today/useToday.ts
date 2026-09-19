import { supabase } from "../lib/supabase";
import { zurichCivilDate } from "../lib/dates";
import { formatCentimes } from "../lib/money-format";
import { throwIfAnyQueryFailed } from "../lib/query";
import type { ReadySession } from "../session/SessionProvider";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import type { SessionState } from "../session/SessionProvider";
import { mockToday } from "./mockToday";
import type { TodayViewModel } from "./types";

export type TodayState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: TodayViewModel };

export { formatCentimes, zurichCivilDate };

export function useToday(session: SessionState): {
  state: TodayState;
  refresh: () => void;
} {
  return useSessionBoundLoad(session, { model: mockToday }, loadToday);
}

async function loadToday(session: ReadySession): Promise<{
  model: TodayViewModel;
}> {
  const { householdId, userId, displayName } = session;
  const today = zurichCivilDate(0);
  const tomorrow = zurichCivilDate(1);

  const [
    membersRes,
    occurrencesRes,
    completionsRes,
    mealsRes,
    itemCountRes,
    sessionsRes,
    draftsRes,
    ledgerRes,
  ] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", householdId),
    supabase
      .from("routine_occurrences")
      .select(
        "id, due_date, planned_assignee_id, routine:routines!inner(title, priority)",
      )
      .eq("household_id", householdId)
      .eq("status", "open")
      .lte("due_date", tomorrow),
    supabase
      .from("routine_completions")
      .select("id", { count: "exact", head: true })
      .eq("household_id", householdId)
      .eq("completed_on", today),
    supabase
      .from("meal_plan_entries")
      .select("id, date, slot, title_snapshot")
      .eq("household_id", householdId)
      .in("date", [today, tomorrow])
      .is("removed_at", null)
      .order("date")
      .order("slot"),
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
    supabase
      .from("expense_drafts")
      .select("id, source_kind, description, amount_cents")
      .eq("household_id", householdId)
      .eq("status", "pending")
      .order("occurred_on"),
    supabase
      .from("ledger_entries")
      .select("member_id, receivable_delta_cents")
      .eq("household_id", householdId),
  ]);

  throwIfAnyQueryFailed([
    { label: "Members", error: membersRes.error },
    { label: "Open routines", error: occurrencesRes.error },
    { label: "Completed routines", error: completionsRes.error },
    { label: "Meals", error: mealsRes.error },
    { label: "Grocery count", error: itemCountRes.error },
    { label: "Shopping sessions", error: sessionsRes.error },
    { label: "Expense drafts", error: draftsRes.error },
    { label: "Ledger", error: ledgerRes.error },
  ]);

  const members = (membersRes.data ?? []) as {
    user_id: string;
    display_name: string;
  }[];
  const partner = members.find((m) => m.user_id !== userId);
  const ledger = (ledgerRes.data ?? []) as {
    member_id: string;
    receivable_delta_cents: number;
  }[];
  const balanceCents = ledger
    .filter((e) => e.member_id === userId)
    .reduce((sum, e) => sum + e.receivable_delta_cents, 0);

  const occurrences = (
    (occurrencesRes.data ?? []) as unknown as {
      id: string;
      due_date: string;
      planned_assignee_id: string | null;
      routine:
        | { title: string; priority: string }
        | { title: string; priority: string }[];
    }[]
  ).map((o) => ({
    id: o.id,
    due_date: o.due_date,
    planned_assignee_id: o.planned_assignee_id,
    routine: Array.isArray(o.routine) ? o.routine[0] : o.routine,
  })) as {
    id: string;
    due_date: string;
    planned_assignee_id: string | null;
    routine: { title: string; priority: string };
  }[];
  const overdue = occurrences
    .filter((o) => o.due_date < today)
    .map((o) => ({
      occurrenceId: o.id,
      title: o.routine.title,
      meta: `Due ${o.due_date}`,
      tone: "overdue" as const,
      canComplete: true,
    }));
  const routinesToday = occurrences
    .filter((o) => o.due_date === today)
    .map((o) => ({
      occurrenceId: o.id,
      title: o.routine.title,
      meta: "Due today",
      tone: "open" as const,
      canComplete: true,
    }));

  const meals = (
    (mealsRes.data ?? []) as {
      id: string;
      date: string;
      slot: string | null;
      title_snapshot: string;
    }[]
  ).map((m) => ({
    kind: "meal" as const,
    entryId: m.id,
    title: m.title_snapshot,
    day: (m.date === today ? "today" : "tomorrow") as "today" | "tomorrow",
    slot: (m.slot ?? null) as "breakfast" | "lunch" | "dinner" | null,
  }));

  const itemCount = itemCountRes.count ?? 0;
  const shoppers = ((sessionsRes.data ?? []) as { member_id: string }[]).map(
    (s) => members.find((m) => m.user_id === s.member_id)?.display_name ?? "?",
  );
  const shopping =
    itemCount === 0
      ? { kind: "empty" as const }
      : shoppers.length > 0
        ? { kind: "live" as const, itemCount, shopperNames: shoppers }
        : { kind: "list" as const, itemCount };

  const pendingDrafts = (
    (draftsRes.data ?? []) as {
      id: string;
      source_kind: string;
      description: string;
      amount_cents: number | null;
    }[]
  ).map((d) => ({
    draftId: d.id,
    title: d.description,
    source: (d.source_kind === "shopping" ? "shopping" : "recurring") as
      "shopping" | "recurring",
    amountLabel: d.amount_cents == null ? null : formatCentimes(d.amount_cents),
  }));

  const completedCount = completionsRes.count ?? 0;
  return {
    model: {
      greetingName: displayName,
      civilDate: today,
      completedCount,
      totalCount: completedCount + overdue.length + routinesToday.length,
      balancePill:
        balanceCents === 0 || !partner
          ? balanceCents === 0
            ? { kind: "settled" }
            : null
          : {
              kind: balanceCents > 0 ? "partner_owes_you" : "you_owe_partner",
              partnerName: partner.display_name,
              amountLabel: formatCentimes(Math.abs(balanceCents)),
            },
      overdue,
      routinesToday,
      meals,
      shopping,
      pendingDrafts,
    },
  };
}
