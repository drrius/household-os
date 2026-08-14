import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  addCivilDays,
  startOfZurichWeek,
  zurichCivilDate,
  ZURICH_TIME_ZONE,
} from "@/lib/ui/zurich-date";

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type PlanViewModel = {
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  timeZoneLabel: "Europe/Zurich";
  today: string;
  days: Array<{
    date: string;
    weekdayLabel: string;
    isToday: boolean;
    slots: Array<{
      slot: MealSlot;
      entry: null | {
        id: string;
        title: string;
        isLeftover: boolean;
        notes: string | null;
        cookLabel: string | null;
      };
    }>;
  }>;
  library: Array<{ id: string; title: string }>;
};

type MealPlanEntryRow = {
  id: string;
  date: string;
  slot: MealSlot;
  title_snapshot: string;
  notes: string | null;
  leftover_of_entry_id: string | null;
};

type MealDefinitionRow = {
  id: string;
  name: string;
};

type MealPrepRow = {
  meal_plan_entry_id: string;
  due_date: string;
  routine: { title: string };
};

type BuildPlanViewModelInput = {
  weekStartParam?: string | null;
  today: string;
  entries: readonly MealPlanEntryRow[];
  library: readonly MealDefinitionRow[];
  prep: readonly MealPrepRow[];
};

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const CIVIL_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: ZURICH_TIME_ZONE,
});
const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "short",
  timeZone: ZURICH_TIME_ZONE,
});
const yearFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  timeZone: ZURICH_TIME_ZONE,
});
const weekdayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  timeZone: ZURICH_TIME_ZONE,
  weekday: "short",
});

function civilDateAtNoon(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00.000Z`);
}

function isCivilDate(value: string): boolean {
  if (!CIVIL_DATE_PATTERN.test(value)) {
    return false;
  }

  const date = civilDateAtNoon(value);
  return (
    Number.isFinite(date.valueOf()) && date.toISOString().slice(0, 10) === value
  );
}

function resolveWeekStart(
  weekStartParam: string | null | undefined,
  today: string,
): string {
  const requestedDate =
    weekStartParam !== null &&
    weekStartParam !== undefined &&
    isCivilDate(weekStartParam)
      ? weekStartParam
      : today;
  return startOfZurichWeek(requestedDate);
}

function formatRangeLabel(weekStart: string, weekEnd: string): string {
  const start = civilDateAtNoon(weekStart);
  const end = civilDateAtNoon(weekEnd);
  const startDay = dayFormatter.format(start);
  const endDay = dayFormatter.format(end);
  const startMonth = monthFormatter.format(start);
  const endMonth = monthFormatter.format(end);
  const startYear = yearFormatter.format(start);
  const endYear = yearFormatter.format(end);

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay} – ${endDay} ${endMonth}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}

function entryKey(date: string, slot: MealSlot): string {
  return `${date}:${slot}`;
}

function cookLabelsByEntry(
  prep: readonly MealPrepRow[],
): ReadonlyMap<string, string> {
  const titlesByEntry = new Map<string, string[]>();
  const sorted = [...prep].sort(
    (left, right) =>
      left.due_date.localeCompare(right.due_date) ||
      left.routine.title.localeCompare(right.routine.title),
  );
  for (const row of sorted) {
    const titles = titlesByEntry.get(row.meal_plan_entry_id) ?? [];
    titles.push(row.routine.title);
    titlesByEntry.set(row.meal_plan_entry_id, titles);
  }
  return new Map(
    [...titlesByEntry].map(([entryId, titles]) => [
      entryId,
      titles.join(" · "),
    ]),
  );
}

function indexEntries(
  rows: readonly MealPlanEntryRow[],
  cookLabels: ReadonlyMap<string, string>,
): ReadonlyMap<
  string,
  PlanViewModel["days"][number]["slots"][number]["entry"]
> {
  const entries = new Map<
    string,
    PlanViewModel["days"][number]["slots"][number]["entry"]
  >();

  for (const row of rows) {
    const key = entryKey(row.date, row.slot);
    if (!entries.has(key)) {
      entries.set(key, {
        id: row.id,
        title: row.title_snapshot,
        isLeftover: row.leftover_of_entry_id !== null,
        notes: row.notes,
        cookLabel: cookLabels.get(row.id) ?? null,
      });
    }
  }

  return entries;
}

export function buildPlanViewModel({
  weekStartParam,
  today,
  entries,
  library,
  prep,
}: BuildPlanViewModelInput): PlanViewModel {
  const weekStart = resolveWeekStart(weekStartParam, today);
  const weekEnd = addCivilDays(weekStart, 6);
  const entriesBySlot = indexEntries(entries, cookLabelsByEntry(prep));
  const days = Array.from({ length: 7 }, (_, offset) => {
    const date = addCivilDays(weekStart, offset);
    return {
      date,
      weekdayLabel: weekdayFormatter.format(civilDateAtNoon(date)),
      isToday: date === today,
      slots: MEAL_SLOTS.map((slot) => ({
        slot,
        entry: entriesBySlot.get(entryKey(date, slot)) ?? null,
      })),
    };
  });

  return {
    weekStart,
    weekEnd,
    rangeLabel: formatRangeLabel(weekStart, weekEnd),
    timeZoneLabel: ZURICH_TIME_ZONE,
    today,
    days,
    library: library.map((meal) => ({ id: meal.id, title: meal.name })),
  };
}

export async function loadPlanViewModel(
  weekStartParam?: string | null,
): Promise<PlanViewModel> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const today = zurichCivilDate();
  const weekStart = resolveWeekStart(weekStartParam, today);
  const weekEnd = addCivilDays(weekStart, 6);
  const entriesQuery = supabase
    .from("meal_plan_entries")
    .select("id, date, slot, title_snapshot, notes, leftover_of_entry_id")
    .eq("household_id", member.householdId)
    .gte("date", weekStart)
    .lte("date", weekEnd)
    .is("removed_at", null)
    .not("slot", "is", null)
    .order("created_at")
    .order("id")
    .overrideTypes<MealPlanEntryRow[], { merge: false }>();
  const libraryQuery = supabase
    .from("meal_definitions")
    .select("id, name")
    .eq("household_id", member.householdId)
    .is("archived_at", null)
    .order("name")
    .overrideTypes<MealDefinitionRow[], { merge: false }>();
  const [entriesResult, libraryResult] = await Promise.all([
    entriesQuery,
    libraryQuery,
  ]);

  if (entriesResult.error) {
    throw new Error(`Meal plan lookup failed: ${entriesResult.error.message}`);
  }
  if (libraryResult.error) {
    throw new Error(
      `Meal library lookup failed: ${libraryResult.error.message}`,
    );
  }

  const entryIds = entriesResult.data.map((entry) => entry.id);
  const prepResult =
    entryIds.length === 0
      ? { data: [] as MealPrepRow[], error: null }
      : await supabase
          .from("routine_occurrences")
          .select("meal_plan_entry_id, due_date, routine:routines!inner(title)")
          .eq("household_id", member.householdId)
          .eq("status", "open")
          .in("meal_plan_entry_id", entryIds)
          .order("due_date")
          .order("id")
          .overrideTypes<MealPrepRow[], { merge: false }>();

  if (prepResult.error) {
    throw new Error(`Meal prep lookup failed: ${prepResult.error.message}`);
  }

  return buildPlanViewModel({
    weekStartParam,
    today,
    entries: entriesResult.data,
    library: libraryResult.data,
    prep: prepResult.data ?? [],
  });
}
