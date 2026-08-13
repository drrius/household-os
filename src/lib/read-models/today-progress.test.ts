import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  mapTodaySnapshot,
  type TodayReadSnapshot,
} from "@/ui/today/today-view-model";

function baseSnapshot(
  overrides: Partial<TodayReadSnapshot> = {},
): TodayReadSnapshot {
  return {
    householdId: "household-1",
    viewerUserId: "user-1",
    greetingName: "Mara",
    civilDate: "2026-08-12",
    members: [
      { user_id: "user-1", display_name: "Mara" },
      { user_id: "user-2", display_name: "Leah" },
    ],
    openOccurrences: [],
    completionsToday: [],
    meals: [],
    activeGroceryCount: 0,
    shoppingSessions: [],
    drafts: [],
    ledgerEntries: [],
    ...overrides,
  };
}

// The loader only fetches open occurrences through tomorrow, so the generator
// stays inside that window.
const occurrenceArbitrary = fc.record({
  dueDate: fc.constantFrom("2026-08-11", "2026-08-12", "2026-08-13"),
  isPrep: fc.boolean(),
});

describe("mapTodaySnapshot progress", () => {
  it("counts the overdue rows the screen shows as outstanding", () => {
    const view = mapTodaySnapshot(
      baseSnapshot({
        openOccurrences: [
          {
            id: "overdue-general",
            due_date: "2026-08-10",
            meal_plan_entry_id: null,
            planned_assignee_id: null,
            routine: { title: "Take out recycling", priority: "general" },
          },
        ],
      }),
    );

    expect(view.overdue).toHaveLength(1);
    expect(view.progress).toEqual({ completedCount: 0, totalCount: 1 });
  });

  it("counts exactly the household work shown as due or done today", () => {
    fc.assert(
      fc.property(
        fc.array(occurrenceArbitrary, { maxLength: 8 }),
        fc.array(fc.boolean(), { maxLength: 4 }),
        (open, completedIsPrep) => {
          const view = mapTodaySnapshot(
            baseSnapshot({
              openOccurrences: open.map((row, index) => ({
                id: `open-${index}`,
                due_date: row.dueDate,
                meal_plan_entry_id: row.isPrep ? `meal-${index}` : null,
                planned_assignee_id: null,
                routine: { title: `Routine ${index}`, priority: "general" },
              })),
              completionsToday: completedIsPrep.map((isPrep, index) => ({
                completed_at: "2026-08-12T06:00:00Z",
                completed_by_member_id: "user-1",
                occurrence: {
                  id: `done-${index}`,
                  due_date: "2026-08-12",
                  meal_plan_entry_id: isPrep ? `meal-done-${index}` : null,
                  planned_assignee_id: null,
                  routine: { title: `Done ${index}`, priority: "general" },
                },
              })),
            }),
          );

          const prepGlances = view.meals.flatMap((meal) =>
            meal.kind === "prep" ? [meal] : [],
          );
          const shownDone =
            view.routinesToday.filter((row) => row.tone === "completed")
              .length +
            prepGlances.filter((meal) => meal.tone === "completed").length;
          const shownOutstanding =
            view.overdue.length +
            view.routinesToday.filter((row) => row.tone !== "completed")
              .length +
            prepGlances.filter(
              (meal) => meal.tone !== "completed" && meal.day !== "tomorrow",
            ).length;

          expect(view.progress.completedCount).toBe(shownDone);
          expect(view.progress.totalCount).toBe(shownDone + shownOutstanding);
        },
      ),
    );
  });
});
