import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { mockToday } from "./mockToday";
import type { TodayViewModel } from "./types";

export type TodayState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: TodayViewModel };

export function zurichCivilDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  return parts;
}

export function formatCentimes(cents: number): string {
  return `CHF ${(cents / 100).toFixed(2)}`;
}

export function useToday(session: SessionState): TodayState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<TodayState>({ status: "loading" });

  useEffect(() => {
    if (session.status === "loading") {
      setState({ status: "loading" });
      return;
    }
    if (session.status === "signed-out") {
      setState({ status: "signed-out" });
      return;
    }
    if (session.status === "error") {
      setState({
        status: "error",
        message: session.message,
        retry: () => setAttempt((n) => n + 1),
      });
      return;
    }
    if (session.status === "mock") {
      setState({ status: "ready", model: mockToday });
      return;
    }
    let cancelled = false;
    const { householdId, userId, displayName } = session;
    void loadToday(householdId, userId, displayName).then((model) => {
      if (!cancelled) setState({ status: "ready", model });
    }).catch((error: unknown) => {
      if (!cancelled) {
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Load failed",
          retry: () => setAttempt((n) => n + 1),
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  return state;
}

async function loadToday(
  householdId: string,
  userId: string,
  displayName: string
): Promise<TodayViewModel> {
  const today = zurichCivilDate(0);
  const tomorrow = zurichCivilDate(1);

  const [membersRes, occurrencesRes, mealsRes, itemCountRes, sessionsRes, draftsRes, ledgerRes] =
    await Promise.all([
      supabase
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", householdId),
      supabase
        .from("routine_occurrences")
        .select("id, due_date, planned_assignee_id, routine:routines!inner(title, priority)")
        .eq("household_id", householdId)
        .eq("status", "open")
        .lte("due_date", tomorrow),
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

  const occurrences = ((occurrencesRes.data ?? []) as unknown as {
    id: string;
    due_date: string;
    planned_assignee_id: string | null;
    routine: { title: string; priority: string } | { title: string; priority: string }[];
  }[]).map((o) => ({
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

  const meals = ((mealsRes.data ?? []) as {
    id: string;
    date: string;
    slot: string | null;
    title_snapshot: string;
  }[]).map((m) => ({
    kind: "meal" as const,
    entryId: m.id,
    title: m.title_snapshot,
    day: (m.date === today ? "today" : "tomorrow") as "today" | "tomorrow",
    slot: (m.slot ?? null) as "breakfast" | "lunch" | "dinner" | null,
  }));

  const itemCount = itemCountRes.count ?? 0;
  const shoppers = ((sessionsRes.data ?? []) as { member_id: string }[]).map(
    (s) =>
      members.find((m) => m.user_id === s.member_id)?.display_name ?? "?"
  );
  const shopping =
    itemCount === 0
      ? { kind: "empty" as const }
      : shoppers.length > 0
        ? { kind: "live" as const, itemCount, shopperNames: shoppers }
        : { kind: "list" as const, itemCount };

  const pendingDrafts = ((draftsRes.data ?? []) as {
    id: string;
    source_kind: string;
    description: string;
    amount_cents: number | null;
  }[]).map((d) => ({
    draftId: d.id,
    title: d.description,
    source: (d.source_kind === "shopping" ? "shopping" : "recurring") as
      | "shopping"
      | "recurring",
    amountLabel: d.amount_cents == null ? null : formatCentimes(d.amount_cents),
  }));

  return {
    greetingName: displayName,
    civilDate: today,
    completedCount: 0,
    totalCount: overdue.length + routinesToday.length,
    balancePill:
      balanceCents === 0 || !partner
        ? balanceCents === 0
          ? { kind: "settled" }
          : null
        : {
            kind:
              balanceCents > 0 ? "partner_owes_you" : "you_owe_partner",
            partnerName: partner.display_name,
            amountLabel: formatCentimes(Math.abs(balanceCents)),
          },
    overdue,
    routinesToday,
    meals,
    shopping,
    pendingDrafts,
  };
}
