import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
export const moneyDetailSchemas = {
  get_financial_event: z.object({ eventId: uuid }),
  get_expense_draft: z.object({ draftId: uuid }),
};
export const MONEY_DETAIL_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_financial_event",
    kind: "read",
    inputSchema: moneyDetailSchemas.get_financial_event,
    description:
      "Read a financial event's exact allocations, related refunds/reversals/replacements and remaining refund availability before proposing a correction or refund. Receipt metadata is not file contents.",
  },
  {
    name: "get_expense_draft",
    kind: "read",
    inputSchema: moneyDetailSchemas.get_expense_draft,
    description:
      "Read a pending expense draft's exact proposed shares, category and shopping context before confirmation. The draft is not a posted obligation; confirming requires explicit approval.",
  },
];
