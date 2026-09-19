import { supabase } from "../lib/supabase";
import { addCivilDays, startOfZurichWeek, zurichCivilDate } from "../lib/dates";
import { throwIfAnyQueryFailed } from "../lib/query";
import type { ReadySession, SessionState } from "../session/SessionProvider";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import { mockPlan } from "./mockPlan";
import type { PlanViewModel } from "./types";

export type PlanState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: PlanViewModel };

export function usePlan(session: SessionState): {
  state: PlanState;
  refresh: () => void;
} {
  return useSessionBoundLoad(session, { model: mockPlan }, loadPlan);
}

async function loadPlan(
  session: ReadySession,
): Promise<{ model: PlanViewModel }> {
  const today = zurichCivilDate(0);
  const weekStart = startOfZurichWeek(today);
  const weekEnd = addCivilDays(weekStart, 6);
  const [mealsRes, libraryRes, routinesRes] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("id, date, slot, title_snapshot, leftover_of_entry_id")
      .eq("household_id", session.householdId)
      .gte("date", weekStart)
      .lte("date", weekEnd)
      .is("removed_at", null)
      .order("date"),
    supabase
      .from("meal_definitions")
      .select("id, name")
      .eq("household_id", session.householdId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("routine_occurrences")
      .select("id, due_date, routine:routines!inner(title)")
      .eq("household_id", session.householdId)
      .eq("status", "open")
      .gte("due_date", weekStart)
      .lte("due_date", weekEnd),
  ]);

  throwIfAnyQueryFailed([
    { label: "Meals", error: mealsRes.error },
    { label: "Meal library", error: libraryRes.error },
    { label: "Week routines", error: routinesRes.error },
  ]);

  const meals = (mealsRes.data ?? []) as {
    id: string;
    date: string;
    slot: string | null;
    title_snapshot: string;
    leftover_of_entry_id: string | null;
  }[];
  const routines = (
    (routinesRes.data ?? []) as unknown as {
      id: string;
      due_date: string;
      routine: { title: string } | { title: string }[];
    }[]
  ).map((o) => ({
    id: o.id,
    due_date: o.due_date,
    title: Array.isArray(o.routine)
      ? (o.routine[0]?.title ?? "?")
      : o.routine.title,
  }));

  const weekday = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
      weekday: "short",
      timeZone: "Europe/Zurich",
    });

  return {
    model: {
      weekStart,
      weekEnd,
      rangeLabel: `${weekStart} – ${weekEnd}`,
      days: Array.from({ length: 7 }, (_, i) => {
        const date = addCivilDays(weekStart, i);
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
        (l) => ({ id: l.id, title: l.name }),
      ),
    },
  };
}
