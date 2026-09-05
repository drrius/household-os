import "server-only";
import { updateRecurringExpenseRule } from "@/lib/money/recurring-commands";
import { updateRecurringSchema } from "../definitions/recurring-tools";
import { recurringStartMatchesSchedule } from "../schedule";
import { resolveAllocations } from "./allocations";
import type { AiWriteHandler } from "./types";
export const RECURRING_HANDLERS: Record<string, AiWriteHandler> = {
  update_recurring_expense_rule: async (input, { idempotencyKey }) => {
    const value = updateRecurringSchema.parse(input);
    if (!recurringStartMatchesSchedule(value.schedule, value.nextOccurrenceOn))
      throw new Error(
        "The next occurrence must match the rule schedule (month-end dates are clamped).",
      );
    const { split, ...fields } = value;
    await updateRecurringExpenseRule({
      ...fields,
      idempotencyKey,
      allocations: await resolveAllocations(
        split,
        value.amountCents,
        value.payerMemberId,
      ),
    });
    return { ruleId: value.ruleId };
  },
};
