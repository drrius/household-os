import "server-only";

import { callMoneyRpc } from "./rpc";

type WeeklySchedule = {
  kind: "weekly";
  isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

type MonthlySchedule = {
  kind: "monthly";
  dayOfMonth: number;
};

export type CreateRecurringExpenseRuleInput = {
  householdId?: string;
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: unknown;
  schedule: WeeklySchedule | MonthlySchedule;
  nextOccurrenceOn: string;
  idempotencyKey: string;
  categoryId?: string | null;
};

function scheduleArguments(
  schedule: WeeklySchedule | MonthlySchedule,
): { p_iso_weekday: number | null; p_day_of_month: number | null } {
  switch (schedule.kind) {
    case "weekly":
      return {
        p_iso_weekday: schedule.isoWeekday,
        p_day_of_month: null,
      };
    case "monthly":
      return {
        p_iso_weekday: null,
        p_day_of_month: schedule.dayOfMonth,
      };
    default: {
      const exhaustive: never = schedule;
      return exhaustive;
    }
  }
}

export async function createRecurringExpenseRule(
  input: CreateRecurringExpenseRuleInput,
): Promise<Record<string, unknown>> {
  return callMoneyRpc("create_recurring_expense_rule", (householdId) => ({
    p_household_id: input.householdId ?? householdId,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_schedule_kind: input.schedule.kind,
    p_next_occurrence_on: input.nextOccurrenceOn,
    p_idempotency_key: input.idempotencyKey,
    ...scheduleArguments(input.schedule),
    p_category_id: input.categoryId ?? null,
  }));
}

export async function setRecurringExpenseRuleActive(input: {
  ruleId: string;
  active: boolean;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  return callMoneyRpc("set_recurring_expense_rule_active", () => ({
    p_rule_id: input.ruleId,
    p_active: input.active,
    p_idempotency_key: input.idempotencyKey,
  }));
}

export async function generateDueRecurringDrafts(input: {
  householdId?: string;
  asOf: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  return callMoneyRpc("generate_due_recurring_drafts", (householdId) => ({
    p_household_id: input.householdId ?? householdId,
    p_as_of: input.asOf,
    p_idempotency_key: input.idempotencyKey,
  }));
}
