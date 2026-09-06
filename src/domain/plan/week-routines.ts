import type {
  HouseholdWeekInput,
  WeekCompletion,
  WeekOccurrence,
  WeekRoutine,
  WeekRoutinePriority,
} from "./week-types";

const priorityOrder: Record<WeekRoutinePriority, number> = {
  pet_care: 0,
  meal_deadline: 1,
  cleaning: 2,
  general: 3,
};

const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  timeZone: "UTC",
});

const completionTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Zurich",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function isMealPrep(occurrence: WeekOccurrence): boolean {
  return occurrence.meal_plan_entry_id !== null;
}

function compareOccurrences(left: WeekOccurrence, right: WeekOccurrence) {
  return (
    priorityOrder[left.routine.priority] -
      priorityOrder[right.routine.priority] ||
    left.due_date.localeCompare(right.due_date) ||
    left.routine.title.localeCompare(right.routine.title) ||
    left.id.localeCompare(right.id)
  );
}

function ownerLabel(input: HouseholdWeekInput, assigneeId: string | null) {
  if (assigneeId === null) return "anyone";
  if (assigneeId === input.viewerUserId) return "yours";
  return input.members[assigneeId] ?? "household";
}

export function routineRows(
  input: HouseholdWeekInput,
  dates: readonly string[],
): ReadonlyMap<string, WeekRoutine[]> {
  const byDay = new Map<string, WeekRoutine[]>();
  const add = (day: string, row: WeekRoutine) => {
    const rows = byDay.get(day) ?? [];
    rows.push(row);
    byDay.set(day, rows);
  };
  const first = dates[0]!;
  const last = dates[dates.length - 1]!;
  const inWeek = (day: string) => first <= day && day <= last;
  const todayInWeek = inWeek(input.today);
  const open = [...input.occurrences]
    .filter((occurrence) => !isMealPrep(occurrence))
    .sort(compareOccurrences);
  for (const occurrence of open) {
    const overdue = occurrence.due_date < input.today;
    const day =
      overdue && todayInWeek
        ? input.today
        : inWeek(occurrence.due_date)
          ? occurrence.due_date
          : null;
    if (day === null) continue;
    const owner = ownerLabel(input, occurrence.planned_assignee_id);
    const since = weekdayFormatter.format(
      new Date(`${occurrence.due_date}T12:00:00Z`),
    );
    add(day, {
      occurrenceId: occurrence.id,
      title: occurrence.routine.title,
      meta: overdue ? `Since ${since} · ${owner}` : owner,
      tone: overdue ? "overdue" : "open",
      canComplete: occurrence.due_date <= input.today,
    });
  }
  const completions = [...input.completions]
    .filter((completion) => !isMealPrep(completion.occurrence))
    .sort(
      (a, b) =>
        a.completed_at.localeCompare(b.completed_at) ||
        a.occurrence.id.localeCompare(b.occurrence.id),
    );
  for (const completion of completions) {
    if (!inWeek(completion.completed_on)) continue;
    add(completion.completed_on, completedRow(input, completion));
  }
  return byDay;
}

function completedRow(
  input: HouseholdWeekInput,
  completion: WeekCompletion,
): WeekRoutine {
  const name = input.members[completion.completed_by_member_id] ?? "Someone";
  return {
    occurrenceId: completion.occurrence.id,
    title: completion.occurrence.routine.title,
    meta: `${name} ${completionTimeFormatter.format(new Date(completion.completed_at))}`,
    tone: "completed",
    canComplete: false,
  };
}
