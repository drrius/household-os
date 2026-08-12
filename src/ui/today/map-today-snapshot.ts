import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import { isExpenseDraftReady } from "@/lib/read-models/expense-draft-readiness";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import {
  addCivilDays,
  formatZurichDayLabel,
  ZURICH_TIME_ZONE,
} from "@/lib/ui/zurich-date";
import type {
  DraftGlance,
  DraftSource,
  MealGlance,
  MemberSource,
  RoutinePriority,
  RoutineRow,
  RoutineSource,
  ShoppingGlance,
  TodayReadSnapshot,
  TodayViewModel,
} from "@/ui/today/today-view-model";

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

function mapDraft(row: DraftSource, memberIds: readonly string[]): DraftGlance {
  const common = {
    draftId: row.id,
    title: row.description,
    source: row.source_kind,
  };
  if (
    row.amount_cents !== null &&
    isExpenseDraftReady({
      amountCents: row.amount_cents,
      payerMemberId: row.payer_member_id,
      memberIds,
      proposedAllocations: row.proposed_allocations,
    })
  ) {
    return {
      ...common,
      kind: "ready",
      amount: formatCentimesAsFrancs(row.amount_cents),
    };
  }
  return {
    ...common,
    kind: "incomplete",
    amount:
      row.amount_cents === null
        ? null
        : formatCentimesAsFrancs(row.amount_cents),
  };
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

function isMealPrepOccurrence(row: RoutineSource): boolean {
  return row.meal_plan_entry_id !== null;
}

export function mapTodaySnapshot(snapshot: TodayReadSnapshot): TodayViewModel {
  const memberNames = new Map(
    snapshot.members.map((member) => [member.user_id, member.display_name]),
  );
  const partner = snapshot.members.find(
    (member) => member.user_id !== snapshot.viewerUserId,
  );
  const sortedOpen = [...snapshot.openOccurrences].sort(compareOccurrences);
  const openHousehold = sortedOpen.filter((row) => !isMealPrepOccurrence(row));
  const openPrep = sortedOpen.filter(isMealPrepOccurrence);
  const overdue = openHousehold
    .filter((row) => row.due_date < snapshot.civilDate)
    .map((row) => mapOpenRoutine(row, "overdue", snapshot, memberNames));
  const openToday = openHousehold
    .filter((row) => row.due_date === snapshot.civilDate)
    .map((row) => mapOpenRoutine(row, "open", snapshot, memberNames));
  const completedHousehold = snapshot.completionsToday.filter(
    (completion) => !isMealPrepOccurrence(completion.occurrence),
  );
  const completed = completedHousehold.map((completion): RoutineRow => ({
    occurrenceId: completion.occurrence.id,
    title: completion.occurrence.routine.title,
    meta: `${memberNames.get(completion.completed_by_member_id) ?? "Someone"} ${completionTimeFormatter.format(new Date(completion.completed_at))}`,
    tone: "completed",
    canComplete: false,
  }));
  const plannedMeals = mapPlannedMeals(snapshot);
  const prepMeals = mapPrepMeals(snapshot, openPrep);
  const completedPrepCount = prepMeals.filter(
    (meal) => meal.kind === "prep" && meal.tone === "completed",
  ).length;
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
      completedCount: completed.length + completedPrepCount,
      totalCount:
        completed.length +
        completedPrepCount +
        openToday.length +
        openPrep.length,
    },
    balancePill: deriveBalancePill(snapshot, partner),
    overdue,
    routinesToday: [...openToday, ...completed],
    meals: [...plannedMeals, ...prepMeals],
    shopping: mapShopping(snapshot.activeGroceryCount, shopperNames),
    pendingDrafts: snapshot.drafts.map((draft) =>
      mapDraft(
        draft,
        snapshot.members.map((member) => member.user_id),
      ),
    ),
  };
}

function mapPlannedMeals(snapshot: TodayReadSnapshot): MealGlance[] {
  const tomorrow = addCivilDays(snapshot.civilDate, 1);
  const mealSlotOrder = {
    breakfast: 0,
    lunch: 1,
    dinner: 2,
  } as const;
  return snapshot.meals
    .flatMap((meal) => {
      if (
        meal.slot === null ||
        (meal.date !== snapshot.civilDate && meal.date !== tomorrow)
      ) {
        return [];
      }
      return [meal] as const;
    })
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        mealSlotOrder[left.slot] - mealSlotOrder[right.slot],
    )
    .map((meal): MealGlance => ({
      kind: "meal",
      entryId: meal.id,
      title: meal.title_snapshot,
      day: meal.date === snapshot.civilDate ? "today" : "tomorrow",
      slot: meal.slot,
    }));
}

function mapPrepMeals(
  snapshot: TodayReadSnapshot,
  openPrep: readonly RoutineSource[],
): MealGlance[] {
  const tomorrow = addCivilDays(snapshot.civilDate, 1);
  const openPrepMeals = openPrep.map((row): MealGlance => {
    const overdue = row.due_date < snapshot.civilDate;
    const day = overdue
      ? "overdue"
      : row.due_date === tomorrow
        ? "tomorrow"
        : "today";
    return {
      kind: "prep",
      occurrenceId: row.id,
      title: row.routine.title,
      day,
      tone: overdue ? "overdue" : "open",
      canComplete: true,
    };
  });
  const completedPrepMeals = snapshot.completionsToday
    .filter((completion) => isMealPrepOccurrence(completion.occurrence))
    .map((completion): MealGlance => ({
      kind: "prep",
      occurrenceId: completion.occurrence.id,
      title: completion.occurrence.routine.title,
      day: "today",
      tone: "completed",
      canComplete: false,
    }));
  return [...openPrepMeals, ...completedPrepMeals];
}
