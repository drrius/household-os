import "server-only";

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

const WRITE_HANDLERS = {
  ...ROUTINE_HANDLERS,
  ...GROCERY_HANDLERS,
  ...MEAL_HANDLERS,
  ...HOUSEHOLD_HANDLERS,
  ...MONEY_DRAFT_HANDLERS,
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
  const handler = WRITE_HANDLERS[name];
  if (definition === null || definition.kind === "read" || !handler) {
    throw new Error(`Unknown assistant write tool: ${name}`);
  }
  const input: unknown = definition.inputSchema.parse(rawInput);
  return handler(input, {
    idempotencyKey: `ai:${name}:${invocationId}`,
    today: zurichCivilDate(),
  });
}
