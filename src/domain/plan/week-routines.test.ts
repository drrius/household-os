import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { buildHouseholdWeek, weekDates } from "./week";
import type { HouseholdWeekInput, WeekOccurrence } from "./week-types";

const weekStart = "2026-09-07";
const today = "2026-09-09";

function occurrence(overrides: Partial<WeekOccurrence> = {}): WeekOccurrence {
  return {
    id: "occ",
    due_date: today,
    planned_assignee_id: null,
    meal_plan_entry_id: null,
    routine: { title: "Water plants", priority: "general" },
    ...overrides,
  };
}

function input(
  overrides: Partial<HouseholdWeekInput> = {},
): HouseholdWeekInput {
  return {
    weekStart,
    today,
    viewerUserId: "viewer",
    members: { viewer: "Anna", partner: "Dan" },
    projects: [],
    tasks: [],
    bookings: [],
    commitments: [],
    events: [],
    occurrences: [],
    completions: [],
    ...overrides,
  };
}

const routinesOn = (
  week: ReturnType<typeof buildHouseholdWeek>,
  date: string,
) => week.find((day) => day.date === date)!.routines;

describe("routines", () => {
  it("moves overdue work into today's column when today is in the week", () => {
    const week = buildHouseholdWeek(
      input({
        occurrences: [
          occurrence({ id: "late", due_date: "2026-09-07" }),
          occurrence({
            id: "soon",
            due_date: "2026-09-11",
            planned_assignee_id: "viewer",
          }),
          occurrence({
            id: "prep",
            due_date: today,
            meal_plan_entry_id: "meal",
          }),
        ],
      }),
    );
    expect(routinesOn(week, "2026-09-07")).toEqual([]);
    expect(routinesOn(week, today)).toEqual([
      {
        occurrenceId: "late",
        title: "Water plants",
        meta: "Since Mon · anyone",
        tone: "overdue",
        canComplete: true,
      },
    ]);
    expect(routinesOn(week, "2026-09-11")).toEqual([
      {
        occurrenceId: "soon",
        title: "Water plants",
        meta: "yours",
        tone: "open",
        canComplete: false,
      },
    ]);
  });

  it("keeps overdue work on its own day in a past week and hides it from a future week", () => {
    const past = buildHouseholdWeek(
      input({
        weekStart: "2026-08-31",
        occurrences: [occurrence({ due_date: "2026-09-02" })],
      }),
    );
    expect(routinesOn(past, "2026-09-02")).toMatchObject([
      { tone: "overdue", meta: "Since Wed · anyone" },
    ]);
    const future = buildHouseholdWeek(
      input({
        weekStart: "2026-09-14",
        occurrences: [occurrence({ due_date: "2026-09-02" })],
      }),
    );
    expect(future.every((day) => day.routines.length === 0)).toBe(true);
  });

  it("records completions on the day they were completed, after open work", () => {
    const week = buildHouseholdWeek(
      input({
        occurrences: [
          occurrence({
            id: "pets",
            routine: { title: "Feed cat", priority: "pet_care" },
          }),
        ],
        completions: [
          {
            completed_on: today,
            completed_at: "2026-09-09T05:15:00Z",
            completed_by_member_id: "partner",
            occurrence: occurrence({
              id: "done",
              routine: { title: "Bins", priority: "cleaning" },
            }),
          },
          {
            completed_on: "2026-09-20",
            completed_at: "2026-09-20T05:15:00Z",
            completed_by_member_id: "partner",
            occurrence: occurrence({ id: "outside" }),
          },
        ],
      }),
    );
    expect(routinesOn(week, today)).toMatchObject([
      { occurrenceId: "pets", tone: "open", canComplete: true },
      {
        occurrenceId: "done",
        tone: "completed",
        meta: "Dan 07:15",
        canComplete: false,
      },
    ]);
    expect(
      week.flatMap((day) => day.routines).map((row) => row.occurrenceId),
    ).not.toContain("outside");
  });

  it("shows every open occurrence at most once and only inside the week", () => {
    const civil = fc
      .integer({ min: 0, max: 40 })
      .map((offset) =>
        new Date(Date.UTC(2026, 7, 20 + offset)).toISOString().slice(0, 10),
      );
    fc.assert(
      fc.property(
        civil,
        civil,
        fc.uniqueArray(
          fc.record({
            id: fc.uuid(),
            due_date: civil,
            planned_assignee_id: fc.constantFrom(null, "viewer", "partner"),
            meal_plan_entry_id: fc.constant(null),
            routine: fc.record({
              title: fc.string({ minLength: 1, maxLength: 8 }),
              priority: fc.constantFrom(
                "pet_care" as const,
                "cleaning" as const,
                "general" as const,
              ),
            }),
          }),
          { selector: (row) => row.id, maxLength: 12 },
        ),
        (anchor, todayCandidate, occurrences) => {
          const start = weekDates(anchor)[0]!;
          const monday = new Date(`${start}T12:00:00Z`);
          const shift = (monday.getUTCDay() + 6) % 7;
          monday.setUTCDate(monday.getUTCDate() - shift);
          const mondayDate = monday.toISOString().slice(0, 10);
          const dates = weekDates(mondayDate);
          const week = buildHouseholdWeek(
            input({
              weekStart: mondayDate,
              today: todayCandidate,
              occurrences,
            }),
          );
          const seen = week.flatMap((day) =>
            day.routines.map((row) => [day.date, row.occurrenceId] as const),
          );
          expect(new Set(seen.map(([, id]) => id)).size).toBe(seen.length);
          for (const [date] of seen) expect(dates).toContain(date);
          for (const row of occurrences) {
            const placed = seen.find(([, id]) => id === row.id);
            const overdue = row.due_date < todayCandidate;
            const expected =
              overdue && dates.includes(todayCandidate)
                ? todayCandidate
                : dates.includes(row.due_date)
                  ? row.due_date
                  : null;
            expect(placed?.[0] ?? null).toBe(expected);
          }
        },
      ),
    );
  });
});
