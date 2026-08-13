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

describe("mapTodaySnapshot", () => {
  it("maps and orders every Today section from one civil-date snapshot", () => {
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
          {
            id: "today-cleaning",
            due_date: "2026-08-12",
            meal_plan_entry_id: null,
            planned_assignee_id: "user-1",
            routine: { title: "Clean the sink", priority: "cleaning" },
          },
          {
            id: "overdue-pet",
            due_date: "2026-08-11",
            meal_plan_entry_id: null,
            planned_assignee_id: "user-2",
            routine: { title: "Wash the cat bowls", priority: "pet_care" },
          },
          {
            id: "today-shared",
            due_date: "2026-08-12",
            meal_plan_entry_id: null,
            planned_assignee_id: null,
            routine: { title: "Water the herbs", priority: "general" },
          },
          {
            id: "today-prep",
            due_date: "2026-08-12",
            meal_plan_entry_id: "meal-today",
            planned_assignee_id: "user-1",
            routine: { title: "Chop onions", priority: "meal_deadline" },
          },
        ],
        completionsToday: [
          {
            completed_at: "2026-08-12T06:10:00Z",
            completed_by_member_id: "user-2",
            occurrence: {
              id: "completed-1",
              due_date: "2026-08-12",
              meal_plan_entry_id: null,
              planned_assignee_id: "user-2",
              routine: { title: "Feed the cat", priority: "pet_care" },
            },
          },
        ],
        meals: [
          {
            id: "meal-today",
            date: "2026-08-12",
            slot: "dinner",
            title_snapshot: "Tomato risotto",
          },
          {
            id: "meal-tomorrow",
            date: "2026-08-13",
            slot: "lunch",
            title_snapshot: "Leftover risotto",
          },
          {
            id: "meal-later",
            date: "2026-08-14",
            slot: "dinner",
            title_snapshot: "Not shown",
          },
        ],
        activeGroceryCount: 4,
        shoppingSessions: [{ member_id: "user-2" }],
        drafts: [
          {
            id: "draft-ready",
            source_kind: "shopping",
            description: "Groceries",
            amount_cents: 4250,
            payer_member_id: "user-2",
            proposed_allocations: [
              { memberId: "user-2", allocatedCents: 2125 },
              { memberId: "user-1", allocatedCents: 2125 },
            ],
          },
          {
            id: "draft-incomplete",
            source_kind: "recurring",
            description: "Internet",
            amount_cents: null,
            payer_member_id: null,
            proposed_allocations: [],
          },
        ],
        ledgerEntries: [
          {
            financial_event_id: "event-1",
            member_id: "user-1",
            receivable_delta_cents: 1250,
          },
          {
            financial_event_id: "event-1",
            member_id: "user-2",
            receivable_delta_cents: -1250,
          },
        ],
      }),
    );

    expect(view.overdue.map((row) => row.occurrenceId)).toEqual([
      "overdue-pet",
      "overdue-general",
    ]);
    expect(view.overdue[0]?.meta).toBe("Since Tuesday · Leah");
    expect(view.routinesToday).toEqual([
      expect.objectContaining({
        occurrenceId: "today-cleaning",
        meta: "yours",
        tone: "open",
      }),
      expect.objectContaining({
        occurrenceId: "today-shared",
        meta: "anyone",
        tone: "open",
      }),
      expect.objectContaining({
        occurrenceId: "completed-1",
        meta: "Leah 08:10",
        tone: "completed",
      }),
    ]);
    expect(view.progress).toEqual({ completedCount: 1, totalCount: 6 });
    expect(view.meals).toEqual([
      expect.objectContaining({
        kind: "meal",
        entryId: "meal-today",
        day: "today",
      }),
      expect.objectContaining({
        kind: "meal",
        entryId: "meal-tomorrow",
        day: "tomorrow",
      }),
      expect.objectContaining({
        kind: "prep",
        occurrenceId: "today-prep",
        title: "Chop onions",
        day: "today",
        tone: "open",
        canComplete: true,
      }),
    ]);
    expect(
      view.routinesToday.some((row) => row.occurrenceId === "today-prep"),
    ).toBe(false);
    expect(view.shopping).toEqual({
      kind: "live",
      itemCount: 4,
      shopperNames: ["Leah"],
    });
    expect(view.pendingDrafts).toEqual([
      expect.objectContaining({
        draftId: "draft-ready",
        kind: "ready",
        amount: "CHF 42.50",
      }),
      expect.objectContaining({
        draftId: "draft-incomplete",
        kind: "incomplete",
        amount: null,
        blocker: "Add the amount before confirming",
      }),
    ]);
    expect(view.balancePill).toEqual({
      kind: "partner_owes_you",
      partnerName: "Leah",
      amount: "CHF 12.50",
    });
  });

  it("derives owed and settled balance variants with integer centimes", () => {
    const owing = mapTodaySnapshot(
      baseSnapshot({
        ledgerEntries: [
          {
            financial_event_id: "event-1",
            member_id: "user-1",
            receivable_delta_cents: -501,
          },
        ],
      }),
    );
    const settled = mapTodaySnapshot(baseSnapshot());

    expect(owing.balancePill).toEqual({
      kind: "you_owe_partner",
      partnerName: "Leah",
      amount: "CHF 5.01",
    });
    expect(settled.balancePill).toEqual({
      kind: "settled",
      partnerName: "Leah",
      amount: "CHF 0.00",
    });
  });

  it("returns empty section variants when the household has no daily work", () => {
    const view = mapTodaySnapshot(
      baseSnapshot({
        members: [{ user_id: "user-1", display_name: "Mara" }],
      }),
    );

    expect(view.overdue).toEqual([]);
    expect(view.routinesToday).toEqual([]);
    expect(view.meals).toEqual([]);
    expect(view.shopping).toEqual({ kind: "empty" });
    expect(view.pendingDrafts).toEqual([]);
    expect(view.balancePill).toBeNull();
  });
});
