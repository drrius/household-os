import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { zurichCivilDate } from "../today/useToday";
import { mockPlan } from "./mockPlan";
import type { PlanViewModel } from "./types";

export type PlanState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: PlanViewModel };

function startOfZurichWeek(today: string): string {
  const [y, m, d] = today.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function usePlan(session: SessionState): PlanState {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<PlanState>({ status: "loading" });

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
      setState({ status: "ready", model: mockPlan });
      return;
    }
    let cancelled = false;
    void loadPlan(session.householdId, zurichCivilDate(0)).then(
      (model) => {
        if (!cancelled) setState({ status: "ready", model });
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: "error",
            message: error instanceof Error ? error.message : "Load failed",
            retry: () => setAttempt((n) => n + 1),
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, [session, attempt]);

  return state;
}

async function loadPlan(
  householdId: string,
  today: string
): Promise<PlanViewModel> {
  const weekStart = startOfZurichWeek(today);
  const weekEnd = addDays(weekStart, 6);
  const [mealsRes, libraryRes, routinesRes] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("id, date, slot, title_snapshot, leftover_of_entry_id")
      .eq("household_id", householdId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .is("removed_at", null)
      .order("date"),
    supabase
      .from("meal_definitions")
      .select("id, name")
      .eq("household_id", householdId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("routine_occurrences")
      .select("id, due_date, routine:routines!inner(title)")
      .eq("household_id", householdId)
      .eq("status", "open")
      .gte("due_date", weekStart)
      .lte("due_date", weekEnd),
  ]);

  const meals = (mealsRes.data ?? []) as {
    id: string;
    date: string;
    slot: string | null;
    title_snapshot: string;
    leftover_of_entry_id: string | null;
  }[];
  const routines = ((routinesRes.data ?? []) as unknown as {
    id: string;
    due_date: string;
    routine: { title: string } | { title: string }[];
  }[]).map((o) => ({
    id: o.id,
    due_date: o.due_date,
    title: Array.isArray(o.routine) ? o.routine[0]?.title ?? "?" : o.routine.title,
  }));

  const weekday = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "Europe/Zurich",
    });

  return {
    weekStart,
    weekEnd,
    rangeLabel: `${weekStart} – ${weekEnd}`,
    days: Array.from({ length: 7 }, (_, i) => {
      const date = addDays(weekStart, i);
      return {
        date,
        weekdayLabel: weekday(date),
        isToday: date === today,
        routines: routines
          .filter((r) => r.due_date === date)
          .map((r) => ({ occurrenceId: r.id, title: r.title })),
        slots: (["breakfast", "lunch", "dinner"] as const).map((slot) => {
          const entry = meals.find((e) => e.date === date && e.slot === slot);
          return {
            slot,
            entry: entry
              ? {
                  id: entry.id,
                  title: entry.title_snapshot,
                  isLeftover: entry.leftover_of_entry_id != null,
                }
              : null,
          };
        }),
      };
    }),
    library: ((libraryRes.data ?? []) as { id: string; name: string }[]).map(
      (l) => ({ id: l.id, title: l.name })
    ),
  };
}
