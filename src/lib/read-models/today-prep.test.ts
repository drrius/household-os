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

describe("mapTodaySnapshot meal prep", () => {
  it("keeps overdue, tomorrow, and completed prep on Meal and prep", () => {
    const view = mapTodaySnapshot(
      baseSnapshot({
        openOccurrences: [
          {
            id: "overdue-prep",
            due_date: "2026-08-10",
            meal_plan_entry_id: "meal-today",
            planned_assignee_id: "user-1",
            routine: { title: "Defrost chicken", priority: "meal_deadline" },
          },
          {
            id: "tomorrow-prep",
            due_date: "2026-08-13",
            meal_plan_entry_id: "meal-tomorrow",
            planned_assignee_id: "user-1",
            routine: { title: "Soak beans", priority: "meal_deadline" },
          },
          {
            id: "tomorrow-routine",
            due_date: "2026-08-13",
            meal_plan_entry_id: null,
            planned_assignee_id: null,
            routine: { title: "Not shown tomorrow", priority: "general" },
          },
        ],
        completionsToday: [
          {
            completed_at: "2026-08-12T07:00:00Z",
            completed_by_member_id: "user-1",
            occurrence: {
              id: "completed-prep",
              due_date: "2026-08-12",
              meal_plan_entry_id: "meal-today",
              planned_assignee_id: "user-1",
              routine: { title: "Chop onions", priority: "meal_deadline" },
            },
          },
        ],
        meals: [
          {
            id: "meal-tomorrow",
            date: "2026-08-13",
            slot: "lunch",
            title_snapshot: "Bean stew",
          },
        ],
      }),
    );

    expect(view.overdue).toEqual([]);
    expect(view.routinesToday).toEqual([]);
    expect(view.meals).toEqual([
      expect.objectContaining({
        kind: "meal",
        entryId: "meal-tomorrow",
        day: "tomorrow",
      }),
      expect.objectContaining({
        kind: "prep",
        occurrenceId: "overdue-prep",
        day: "overdue",
        tone: "overdue",
        canComplete: true,
      }),
      expect.objectContaining({
        kind: "prep",
        occurrenceId: "tomorrow-prep",
        day: "tomorrow",
        tone: "open",
        canComplete: true,
      }),
      expect.objectContaining({
        kind: "prep",
        occurrenceId: "completed-prep",
        day: "today",
        tone: "completed",
        canComplete: false,
      }),
    ]);
    expect(view.progress).toEqual({ completedCount: 1, totalCount: 3 });
  });
});
