import { GROCERY_DETAIL_TOOLS } from "./grocery-detail-tools";
import { LIBRARY_TOOLS } from "./library-tools";
import { RECURRING_TOOLS } from "./recurring-tools";
import { PROJECT_DETAIL_TOOLS } from "./project-detail-tools";
import { COST_TOOLS } from "./cost-tools";
import { CALENDAR_TOOLS } from "./calendar-tools";
import { HOME_TOOLS } from "./home-tools";
import { BOOKING_TOOLS } from "./booking-tools";
import { PROJECT_TOOLS } from "./project-tools";
import { CONNECTED_READ_TOOLS } from "./connected-read-tools";
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
  ...CONNECTED_READ_TOOLS,
  ...PROJECT_TOOLS,
  ...PROJECT_DETAIL_TOOLS,
  ...BOOKING_TOOLS,
  ...HOME_TOOLS,
  ...CALENDAR_TOOLS,
  ...ROUTINE_TOOLS,
  ...GROCERY_TOOLS,
  ...GROCERY_DETAIL_TOOLS,
  ...MEAL_TOOLS,
  ...LIBRARY_TOOLS,
  ...HOUSEHOLD_TOOLS,
  ...MONEY_DRAFT_TOOLS,
  ...RECURRING_TOOLS,
  ...FINANCIAL_TOOLS,
  ...COST_TOOLS,
] as const;

export const FINANCIAL_TOOL_NAMES: readonly string[] =
  AI_TOOL_DEFINITIONS.filter(
    (definition) => definition.kind === "financial",
  ).map((definition) => definition.name);

export function getAiToolDefinition(name: string) {
  return (
    AI_TOOL_DEFINITIONS.find((definition) => definition.name === name) ?? null
  );
}
