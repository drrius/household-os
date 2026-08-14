import { EXPENSE_DRAFT_BLOCKER_COPY } from "@/lib/read-models/expense-draft-readiness";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import type { TodayViewModel } from "@/ui/today/today-view-model";

export const todayFixture: TodayViewModel = {
  householdId: "household-fixture",
  viewerUserId: "darius-fixture",
  greetingName: "Darius ☀",
  civilDate: "2026-08-12",
  dateLabel: "Wednesday 12 August",
  // 1 completed routine plus the overdue row and the open routine below.
  progress: { completedCount: 1, totalCount: 3 },
  balancePill: {
    kind: "partner_owes_you",
    partnerName: "Leah",
    amount: formatCentimesAsFrancs(2350),
  },
  overdue: [
    {
      occurrenceId: "overdue-fixture",
      title: "The plants are thirsty",
      meta: "Since Monday · yours",
      tone: "overdue",
      canComplete: false,
    },
  ],
  routinesToday: [
    {
      occurrenceId: "completed-fixture",
      title: "Feed Jodie",
      meta: "Leah · 08:10",
      tone: "completed",
      canComplete: false,
    },
    {
      occurrenceId: "open-fixture",
      title: "Vacuum the living room",
      meta: "Yours · weekly",
      tone: "open",
      canComplete: false,
    },
  ],
  meals: [
    {
      kind: "meal",
      entryId: "meal-fixture",
      title: "Green veggie curry",
      day: "today",
      slot: "dinner",
    },
  ],
  shopping: {
    kind: "live",
    itemCount: 12,
    shopperNames: ["Leah"],
  },
  pendingDrafts: [
    {
      kind: "incomplete",
      draftId: "draft-fixture",
      title: "Coop groceries",
      source: "shopping",
      amount: formatCentimesAsFrancs(8430),
      blocker: EXPENSE_DRAFT_BLOCKER_COPY.payer,
    },
  ],
};
