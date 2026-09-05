import { z } from "zod";
import {
  centimes,
  expenseSplitSchema,
  isoDate,
  isoWeekday,
  uuid,
  withSplitAmountCheck,
  type AiToolDefinition,
} from "./schemas";
export const updateRecurringSchema = withSplitAmountCheck(
  z.object({
    ruleId: uuid,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    description: z.string().trim().min(1).max(200),
    amountCents: centimes,
    payerMemberId: uuid,
    split: expenseSplitSchema,
    schedule: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("weekly"), isoWeekday }),
      z.object({
        kind: z.literal("monthly"),
        dayOfMonth: z.number().int().min(1).max(31),
      }),
    ]),
    nextOccurrenceOn: isoDate,
    categoryId: uuid.nullable(),
  }),
);
export const RECURRING_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_recurring_expense_rules",
    kind: "read",
    inputSchema: z.object({}),
    description:
      "Read recurring expense rules including current versions, exact proposed allocations and categories. Use these values before editing a rule; rules generate drafts, never automatic ledger payments.",
  },
  {
    name: "update_recurring_expense_rule",
    kind: "write",
    inputSchema: updateRecurringSchema,
    description:
      "Edit a recurring expense rule using its current updated_at version. Preserve unchanged fields and exact custom shares from get_recurring_expense_rules. Changes future draft generation only; existing financial history remains unchanged.",
  },
];
