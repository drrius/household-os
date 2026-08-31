import { READ_TOOLS } from "@/lib/ai/definitions/read-tools";
import { ROUTINE_TOOLS } from "@/lib/ai/definitions/routine-tools";
import {
  GROCERY_TOOLS,
  HOUSEHOLD_TOOLS,
  MEAL_TOOLS,
} from "@/lib/ai/definitions/planning-tools";
import {
  FINANCIAL_TOOLS,
  MONEY_DRAFT_TOOLS,
} from "@/lib/ai/definitions/money-tools";

export {
  expenseSplitSchema,
  scheduleInputSchema,
  type AiToolDefinition,
  type AiToolKind,
} from "@/lib/ai/definitions/schemas";

/**
 * The complete contract of assistant actions. Both the in-app chat agent and
 * the MCP bridge build their tool surfaces from this one list.
 */
export const AI_TOOL_DEFINITIONS = [
  ...READ_TOOLS,
  ...ROUTINE_TOOLS,
  ...GROCERY_TOOLS,
  ...MEAL_TOOLS,
  ...HOUSEHOLD_TOOLS,
  ...MONEY_DRAFT_TOOLS,
  ...FINANCIAL_TOOLS,
] as const;

export const FINANCIAL_TOOL_NAMES: readonly string[] = FINANCIAL_TOOLS.map(
  (definition) => definition.name,
);

export function getAiToolDefinition(name: string) {
  return (
    AI_TOOL_DEFINITIONS.find((definition) => definition.name === name) ?? null
  );
}
