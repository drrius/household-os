import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import {
  formatCentimesAsFrancs,
  type FrancDisplay,
} from "@/lib/ui/franc-display";
import {
  addCivilDays,
  formatZurichDayLabel,
  ZURICH_TIME_ZONE,
} from "@/lib/ui/zurich-date";

export type RoutinePriority =
  "pet_care" | "meal_deadline" | "cleaning" | "general";
export type MealSlot = "breakfast" | "lunch" | "dinner" | null;

export type MemberSource = { user_id: string; display_name: string };
export type RoutineSource = {
  id: string;
  due_date: string;
  planned_assignee_id: string | null;
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

export type MealGlance = {
  entryId: string;
  title: string;
  day: "today" | "tomorrow";
  slot: MealSlot;
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

const priorityOrder: Record<RoutinePriority, number> = {
  pet_care: 0,
  meal_deadline: 1,
  cleaning: 2,
  general: 3,
};

const completionTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZURICH_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function assigneeLabel(
  assigneeId: string | null,
  viewerUserId: string,
  memberNames: ReadonlyMap<string, string>,
): string {
  if (assigneeId === null) return "anyone";
  if (assigneeId === viewerUserId) return "yours";
  return memberNames.get(assigneeId) ?? "household";
}

function compareOccurrences(left: RoutineSource, right: RoutineSource): number {
  return (
    priorityOrder[left.routine.priority] -
      priorityOrder[right.routine.priority] ||
    left.due_date.localeCompare(right.due_date) ||
    left.routine.title.localeCompare(right.routine.title)
  );
}

function mapOpenRoutine(
  row: RoutineSource,
  tone: "overdue" | "open",
  snapshot: TodayReadSnapshot,
  memberNames: ReadonlyMap<string, string>,
): RoutineRow {
  const owner = assigneeLabel(
    row.planned_assignee_id,
    snapshot.viewerUserId,
    memberNames,
  );
  const [weekday] = formatZurichDayLabel(row.due_date).split(",");
  return {
    occurrenceId: row.id,
    title: row.routine.title,
    meta: tone === "overdue" ? `Since ${weekday} · ${owner}` : owner,
    tone,
    canComplete: true,
  };
}

function mapDraft(row: DraftSource): DraftGlance {
  const common = {
    draftId: row.id,
    title: row.description,
    source: row.source_kind,
  };
  const amount =
    row.amount_cents === null ? null : formatCentimesAsFrancs(row.amount_cents);
  const ready =
    amount !== null &&
    row.payer_member_id !== null &&
    Array.isArray(row.proposed_allocations) &&
    row.proposed_allocations.length === 2;
  return ready
    ? { ...common, kind: "ready", amount }
    : { ...common, kind: "incomplete", amount };
}

function deriveBalancePill(
  snapshot: TodayReadSnapshot,
  partner: MemberSource | undefined,
): TodayViewModel["balancePill"] {
  if (partner === undefined) return null;
  const entries = snapshot.ledgerEntries.map((entry) => ({
    financialEventId: asFinancialEventId(entry.financial_event_id),
    memberId: asMemberId(entry.member_id),
    receivableDeltaCents: entry.receivable_delta_cents,
  }));
  const balance =
    deriveMemberBalances(entries).get(asMemberId(snapshot.viewerUserId)) ?? 0;
  const amount = formatCentimesAsFrancs(Math.abs(balance));
  if (balance > 0) {
    return {
      kind: "partner_owes_you",
      partnerName: partner.display_name,
      amount,
    };
  }
  if (balance < 0) {
    return {
      kind: "you_owe_partner",
      partnerName: partner.display_name,
      amount,
    };
  }
  return {
    kind: "settled",
    partnerName: partner.display_name,
    amount,
  };
}

function mapShopping(
  itemCount: number,
  shopperNames: readonly string[],
): ShoppingGlance {
  if (shopperNames.length > 0) {
    return { kind: "live", itemCount, shopperNames };
  }
  if (itemCount > 0) {
    return { kind: "list", itemCount };
  }
  return { kind: "empty" };
}

export function mapTodaySnapshot(snapshot: TodayReadSnapshot): TodayViewModel {
  const memberNames = new Map(
    snapshot.members.map((member) => [member.user_id, member.display_name]),
  );
  const partner = snapshot.members.find(
    (member) => member.user_id !== snapshot.viewerUserId,
  );
  const sortedOpen = [...snapshot.openOccurrences].sort(compareOccurrences);
  const overdue = sortedOpen
    .filter((row) => row.due_date < snapshot.civilDate)
    .map((row) => mapOpenRoutine(row, "overdue", snapshot, memberNames));
  const openToday = sortedOpen
    .filter((row) => row.due_date === snapshot.civilDate)
    .map((row) => mapOpenRoutine(row, "open", snapshot, memberNames));
  const completed = snapshot.completionsToday.map((completion): RoutineRow => ({
    occurrenceId: completion.occurrence.id,
    title: completion.occurrence.routine.title,
    meta: `${memberNames.get(completion.completed_by_member_id) ?? "Someone"} ${completionTimeFormatter.format(new Date(completion.completed_at))}`,
    tone: "completed",
    canComplete: false,
  }));
  const tomorrow = addCivilDays(snapshot.civilDate, 1);
  const meals = snapshot.meals
    .filter(
      (meal) => meal.date === snapshot.civilDate || meal.date === tomorrow,
    )
    .map((meal): MealGlance => ({
      entryId: meal.id,
      title: meal.title_snapshot,
      day: meal.date === snapshot.civilDate ? "today" : "tomorrow",
      slot: meal.slot,
    }));
  const shopperNames = snapshot.shoppingSessions.map(
    (session) => memberNames.get(session.member_id) ?? "Someone",
  );
  return {
    householdId: snapshot.householdId,
    viewerUserId: snapshot.viewerUserId,
    greetingName: snapshot.greetingName,
    civilDate: snapshot.civilDate,
    dateLabel: formatZurichDayLabel(snapshot.civilDate),
    progress: {
      completedCount: completed.length,
      totalCount: completed.length + openToday.length,
    },
    balancePill: deriveBalancePill(snapshot, partner),
    overdue,
    routinesToday: [...openToday, ...completed],
    meals,
    shopping: mapShopping(snapshot.activeGroceryCount, shopperNames),
    pendingDrafts: snapshot.drafts.map(mapDraft),
  };
}
