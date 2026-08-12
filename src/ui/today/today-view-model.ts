import type { FrancDisplay } from "@/lib/ui/franc-display";

export type RoutinePriority =
  "pet_care" | "meal_deadline" | "cleaning" | "general";
export type MealSlot = "breakfast" | "lunch" | "dinner" | null;

export type MemberSource = { user_id: string; display_name: string };
export type RoutineSource = {
  id: string;
  due_date: string;
  planned_assignee_id: string | null;
  meal_plan_entry_id: string | null;
  routine: { title: string; priority: RoutinePriority };
};
export type CompletionSource = {
  completed_at: string;
  completed_by_member_id: string;
  occurrence: RoutineSource;
};
export type MealSource = {
  id: string;
  date: string;
  slot: MealSlot;
  title_snapshot: string;
};
export type ShoppingSessionSource = { member_id: string };
export type DraftSource = {
  id: string;
  source_kind: "shopping" | "recurring";
  description: string;
  amount_cents: number | null;
  payer_member_id: string | null;
  proposed_allocations: unknown;
};
export type LedgerSource = {
  financial_event_id: string;
  member_id: string;
  receivable_delta_cents: number;
};

export type RoutineRow = {
  occurrenceId: string;
  title: string;
  meta: string;
  tone: "overdue" | "open" | "completed";
  canComplete: boolean;
};

export type MealGlance =
  | {
      kind: "meal";
      entryId: string;
      title: string;
      day: "today" | "tomorrow";
      slot: MealSlot;
    }
  | {
      kind: "prep";
      occurrenceId: string;
      title: string;
      day: "today" | "tomorrow" | "overdue";
      tone: "open" | "completed" | "overdue";
      canComplete: boolean;
    };

export type ShoppingGlance =
  | { kind: "empty" }
  | { kind: "list"; itemCount: number }
  | { kind: "live"; itemCount: number; shopperNames: readonly string[] };

type DraftBase = {
  draftId: string;
  title: string;
  source: "shopping" | "recurring";
};

export type DraftGlance =
  | (DraftBase & { kind: "ready"; amount: FrancDisplay })
  | (DraftBase & { kind: "incomplete"; amount: FrancDisplay | null });

export type TodayViewModel = {
  householdId: string;
  viewerUserId: string;
  greetingName: string;
  civilDate: string;
  dateLabel: string;
  progress: { completedCount: number; totalCount: number };
  balancePill: null | {
    kind: "partner_owes_you" | "you_owe_partner" | "settled";
    partnerName: string;
    amount: FrancDisplay;
  };
  overdue: RoutineRow[];
  routinesToday: RoutineRow[];
  meals: MealGlance[];
  shopping: ShoppingGlance;
  pendingDrafts: DraftGlance[];
};

export type TodayReadSnapshot = {
  householdId: string;
  viewerUserId: string;
  greetingName: string;
  civilDate: string;
  members: readonly MemberSource[];
  openOccurrences: readonly RoutineSource[];
  completionsToday: readonly CompletionSource[];
  meals: readonly MealSource[];
  activeGroceryCount: number;
  shoppingSessions: readonly ShoppingSessionSource[];
  drafts: readonly DraftSource[];
  ledgerEntries: readonly LedgerSource[];
};

export { mapTodaySnapshot } from "@/ui/today/map-today-snapshot";
