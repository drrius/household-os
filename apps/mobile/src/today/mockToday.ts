import type { TodayViewModel } from "./types";

export const mockToday: TodayViewModel = {
  greetingName: "Alex",
  civilDate: "2026-09-15",
  completedCount: 2,
  totalCount: 5,
  balancePill: {
    kind: "partner_owes_you",
    partnerName: "Sam",
    amountLabel: "CHF 12.40",
  },
  overdue: [
    {
      occurrenceId: "occ-overdue-1",
      title: "Vacuum living room",
      meta: "Due yesterday",
      tone: "overdue",
      canComplete: true,
    },
  ],
  routinesToday: [
    {
      occurrenceId: "occ-today-1",
      title: "Feed Milo",
      meta: "Due today",
      tone: "open",
      canComplete: true,
    },
    {
      occurrenceId: "occ-today-2",
      title: "Take out recycling",
      meta: "Due today",
      tone: "open",
      canComplete: true,
    },
  ],
  meals: [
    {
      kind: "meal",
      entryId: "meal-1",
      title: "Rösti night",
      day: "today",
      slot: "dinner",
    },
  ],
  shopping: { kind: "list", itemCount: 6 },
  pendingDrafts: [
    {
      draftId: "draft-1",
      title: "Migros run",
      source: "shopping",
      amountLabel: "CHF 48.20",
    },
  ],
};
