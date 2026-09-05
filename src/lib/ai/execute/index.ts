import "server-only";
import { ATTACHMENT_HANDLERS } from "../attachments";
import { CATEGORY_HANDLERS } from "./categories";
import { NOTIFICATION_HANDLERS } from "./notifications";
import { DAILY_DETAIL_HANDLERS } from "./daily-details";
import { GROCERY_DETAIL_HANDLERS } from "./grocery-details";
import { LIBRARY_HANDLERS } from "./library";
import { RECURRING_HANDLERS } from "./recurring";
import { PROJECT_STARTER_HANDLERS } from "./project-starters";
import { COST_HANDLERS } from "./costs";
import { CALENDAR_HANDLERS } from "./calendar";
import { HOME_HANDLERS } from "./home";
import { BOOKING_HANDLERS } from "./bookings";
import { PROJECT_HANDLERS } from "./projects";

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { FINANCIAL_HANDLERS } from "@/lib/ai/execute/money";
import { MONEY_DRAFT_HANDLERS } from "@/lib/ai/execute/money-drafts";
import {
  GROCERY_HANDLERS,
  HOUSEHOLD_HANDLERS,
  MEAL_HANDLERS,
} from "@/lib/ai/execute/planning";
import { ROUTINE_HANDLERS } from "@/lib/ai/execute/routines";
import type { AiWriteResult } from "@/lib/ai/execute/types";
import { zurichCivilDate } from "@/lib/ui/zurich-date";

export const AI_WRITE_HANDLERS = {
  ...ATTACHMENT_HANDLERS,
  ...CATEGORY_HANDLERS,
  ...NOTIFICATION_HANDLERS,
  ...DAILY_DETAIL_HANDLERS,
  ...COST_HANDLERS,
  ...PROJECT_HANDLERS,
  ...PROJECT_STARTER_HANDLERS,
  ...BOOKING_HANDLERS,
  ...HOME_HANDLERS,
  ...CALENDAR_HANDLERS,
  ...ROUTINE_HANDLERS,
  ...GROCERY_HANDLERS,
  ...GROCERY_DETAIL_HANDLERS,
  ...MEAL_HANDLERS,
  ...LIBRARY_HANDLERS,
  ...HOUSEHOLD_HANDLERS,
  ...MONEY_DRAFT_HANDLERS,
  ...RECURRING_HANDLERS,
  ...FINANCIAL_HANDLERS,
};

/**
 * Executes one assistant write tool as the signed-in member. `invocationId`
 * must be stable per logical tool call (the chat tool-call id, or the MCP
 * caller's idempotency key) so retries dedupe instead of double-applying.
 */
export async function executeAiWrite(
  name: string,
  rawInput: unknown,
  invocationId: string,
): Promise<AiWriteResult> {
  const definition = getAiToolDefinition(name);
  const handler = AI_WRITE_HANDLERS[name];
  if (definition === null || definition.kind === "read" || !handler) {
    throw new Error(`Unknown assistant write tool: ${name}`);
  }
  if (!invocationId.trim())
    throw new Error("A stable tool invocation ID is required.");
  const input: unknown = definition.inputSchema.parse(rawInput);
  return handler(input, {
    idempotencyKey: `ai:${name}:${invocationId}`,
    today: zurichCivilDate(),
  });
}
