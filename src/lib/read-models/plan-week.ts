import "server-only";
import { unstable_rethrow } from "next/navigation";
import { buildHouseholdWeek } from "@/domain/plan/week";
import type {
  HouseholdWeekDay,
  WeekCompletion,
  WeekOccurrence,
} from "@/domain/plan/week-types";
import { loadCalendarOccurrences } from "@/lib/calendar/agenda";
import { addCivilDays } from "@/lib/ui/zurich-date";
import { loadPlanningSources, readPages } from "./planning-sources";

export type HouseholdWeekModel = {
  days: HouseholdWeekDay[];
  warnings: { id: string; title: string }[];
  syncAttention: number;
};

const occurrenceFields =
  "id, due_date, planned_assignee_id, meal_plan_entry_id, routine:routines!inner(title, priority)";

export async function loadHouseholdWeek(
  weekStart: string,
  today: string,
): Promise<HouseholdWeekModel> {
  const weekEnd = addCivilDays(weekStart, 6);
  const [sources, calendar] = await Promise.all([
    loadPlanningSources({ from: weekStart, to: weekEnd }),
    loadCalendarOccurrences(weekStart, addCivilDays(weekEnd, 1)),
  ]);
  const { db, member } = sources;
  // Overdue work belongs in today's column, so the current week reads back
  // past the Monday; any other week reads only its own days.
  const todayInWeek = weekStart <= today && today <= weekEnd;
  const [occurrences, completions] = await Promise.all([
    readPages<WeekOccurrence>((from, to) => {
      let query = db
        .from("routine_occurrences")
        .select(occurrenceFields)
        .eq("household_id", member.householdId)
        .eq("status", "open")
        .eq("role", "current")
        .is("routine.paused_at", null)
        .is("routine.archived_at", null)
        .lte("due_date", weekEnd);
      if (!todayInWeek) query = query.gte("due_date", weekStart);
      return query.order("id").range(from, to);
    }),
    readPages<WeekCompletion>((from, to) =>
      db
        .from("routine_completions")
        .select(
          `completed_on, completed_at, completed_by_member_id, occurrence:routine_occurrences!inner(${occurrenceFields})`,
        )
        .eq("household_id", member.householdId)
        .gte("completed_on", weekStart)
        .lte("completed_on", weekEnd)
        .order("completed_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  return {
    days: buildHouseholdWeek({
      weekStart,
      today,
      viewerUserId: member.userId,
      members: sources.members,
      projects: sources.projects,
      tasks: sources.tasks,
      bookings: sources.bookings,
      commitments: sources.commitments,
      events: calendar.items,
      occurrences,
      completions,
    }),
    warnings: calendar.warnings.map(({ id, title }) => ({ id, title })),
    syncAttention: calendar.attention.length,
  };
}

/** Null when the week's plans cannot load; meals still render without them. */
export async function loadHouseholdWeekOrNull(
  weekStart: string,
  today: string,
): Promise<HouseholdWeekModel | null> {
  try {
    return await loadHouseholdWeek(weekStart, today);
  } catch (error) {
    unstable_rethrow(error);
    return null;
  }
}
