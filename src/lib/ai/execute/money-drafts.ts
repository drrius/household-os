import "server-only";

import {
  resolveAllocations,
  type ExpenseSplit,
} from "@/lib/ai/execute/allocations";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
import { recurringStartMatchesSchedule } from "@/lib/ai/schedule";
import {
  createRecurringExpenseRule,
  dismissExpenseDraft,
  setRecurringExpenseRuleActive,
} from "@/lib/money/commands";

export const MONEY_DRAFT_HANDLERS: Record<string, AiWriteHandler> = {
  dismiss_expense_draft: (input) => {
    const value = input as { draftId: string };
    return dismissExpenseDraft({
      draftId: value.draftId,
      idempotencyKey: `dismiss-expense-draft:${value.draftId}`,
    });
  },
  create_recurring_expense_rule: async (input, { idempotencyKey }) => {
    const value = input as {
      description: string;
      amountCents: number;
      payerMemberId: string;
      split: ExpenseSplit;
      schedule:
        | { kind: "weekly"; isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
        | { kind: "monthly"; dayOfMonth: number };
      nextOccurrenceOn: string;
      categoryId?: string | null;
    };
    // Fail with a usable message instead of the database's, which would
    // otherwise reject the rule after the tool call already ran.
    if (
      !recurringStartMatchesSchedule(value.schedule, value.nextOccurrenceOn)
    ) {
      throw new Error(
        value.schedule.kind === "weekly"
          ? "nextOccurrenceOn must fall on the schedule's weekday"
          : "nextOccurrenceOn must match the schedule's day of month (clamped to the month's length)",
      );
    }
    return createRecurringExpenseRule({
      description: value.description,
      amountCents: value.amountCents,
      payerMemberId: value.payerMemberId,
      allocations: await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      ),
      schedule: value.schedule,
      nextOccurrenceOn: value.nextOccurrenceOn,
      idempotencyKey,
      categoryId: value.categoryId ?? null,
    });
  },
  set_recurring_expense_rule_active: (input, { idempotencyKey }) => {
    const value = input as { ruleId: string; active: boolean };
    return setRecurringExpenseRuleActive({
      ruleId: value.ruleId,
      active: value.active,
      idempotencyKey: `${idempotencyKey}:${value.active}`,
    });
  },
};
