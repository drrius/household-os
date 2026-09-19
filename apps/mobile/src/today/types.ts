export type RoutineTone = "overdue" | "open" | "completed";

export type RoutineRow = {
  occurrenceId: string;
  title: string;
  meta: string;
  tone: RoutineTone;
  canComplete: boolean;
};

export type MealGlance =
  | {
      kind: "meal";
      entryId: string;
      title: string;
      day: "today" | "tomorrow";
      slot: "breakfast" | "lunch" | "dinner" | null;
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
  | { kind: "live"; itemCount: number; shopperNames: string[] };

export type DraftGlance = {
  draftId: string;
  title: string;
  source: "shopping" | "recurring";
  amountLabel: string | null;
};

export type BalancePill =
  | { kind: "settled" }
  | {
      kind: "partner_owes_you" | "you_owe_partner";
      partnerName: string;
      amountLabel: string;
    };

export type TodayViewModel = {
  greetingName: string;
  civilDate: string;
  completedCount: number;
  totalCount: number;
  balancePill: BalancePill | null;
  overdue: RoutineRow[];
  routinesToday: RoutineRow[];
  meals: MealGlance[];
  shopping: ShoppingGlance;
  pendingDrafts: DraftGlance[];
};
