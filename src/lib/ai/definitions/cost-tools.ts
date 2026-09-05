import { z } from "zod";
import { costTargetSchema } from "@/domain/money/cost-target";
import {
  centimes,
  expenseSplitSchema,
  isoDate,
  uuid,
  withSplitAmountCheck,
  type AiToolDefinition,
} from "./schemas";

export const costReadSchemas = {
  get_context_costs: z.object({
    target: costTargetSchema,
    before: z.object({ occurred_on: isoDate, id: uuid }).optional(),
  }),
  get_expense_association: z.object({ eventId: uuid }),
  get_association_expenses: z.object({
    before: z.object({ beforeOn: isoDate, beforeId: uuid }).optional(),
  }),
};
export const contextualExpenseSchema = withSplitAmountCheck(
  z.object({
    target: costTargetSchema,
    contextTitle: z
      .string()
      .min(1)
      .max(200)
      .describe(
        "Current record title from the lookup; shown for approval and verified before posting",
      ),
    bookingTitle: z
      .string()
      .min(1)
      .max(200)
      .nullable()
      .describe("Current booking title, or null without a booking"),
    description: z.string().trim().min(1).max(200),
    amountCents: centimes,
    payerMemberId: uuid,
    split: expenseSplitSchema,
    occurredOn: isoDate,
    categoryId: uuid.nullish(),
    note: z.string().max(500).nullish(),
  }),
);
export const associationSchema = z.object({
  eventId: uuid,
  expectedRevision: uuid
    .nullable()
    .describe(
      "Current association revision, including an archived association; null only if no association exists",
    ),
  target: costTargetSchema
    .nullable()
    .describe(
      "Null removes the association without changing financial history",
    ),
});
export const COST_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_context_costs",
    kind: "read",
    inputSchema: costReadSchemas.get_context_costs,
    description:
      "Read net recorded CHF costs and paginated ledger events for a trip/project, booking, inventory item or commitment. Decimal strings preserve exact centimes. Estimates are separate; costs never imply a member balance.",
  },
  {
    name: "get_expense_association",
    kind: "read",
    inputSchema: costReadSchemas.get_expense_association,
    description:
      "Read an expense and its current context association and revision before linking, moving or unlinking it.",
  },
  {
    name: "get_association_expenses",
    kind: "read",
    inputSchema: costReadSchemas.get_association_expenses,
    description:
      "Find recorded expenses eligible for context association. When hasMore, use the last expense date and ID as the next cursor.",
  },
  {
    name: "record_contextual_expense",
    kind: "financial",
    inputSchema: contextualExpenseSchema,
    description:
      "With explicit member approval, atomically record a shared expense and associate it with a trip/project, booking, inventory item or commitment. Read the exact target and title first. Amounts are integer CHF centimes; this posts a real financial obligation, not an estimate.",
  },
  {
    name: "assign_expense_context",
    kind: "write",
    inputSchema: associationSchema,
    description:
      "Link, move or unlink an existing expense's context. Read get_expense_association first for its revision. Changes categorization only, never ledger amounts or balances.",
  },
];
