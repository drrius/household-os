import "server-only";

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { executeAiWrite } from "@/lib/ai/execute";
import {
  readGroceryList,
  readHousehold,
  readRoutines,
  readTodayOverview,
  readWeekPlan,
} from "@/lib/ai/reads";
import { readMoneyOverview } from "@/lib/ai/reads-money";

/**
 * Single entry point for both the chat agent and the MCP bridge: validates
 * the input against the tool's schema and runs it as the signed-in member.
 */
export async function executeAiTool(
  name: string,
  rawInput: unknown,
  invocationId: string,
): Promise<Record<string, unknown> | { done: true }> {
  const definition = getAiToolDefinition(name);
  if (definition === null) {
    throw new Error(`Unknown assistant tool: ${name}`);
  }
  if (definition.kind !== "read") {
    return executeAiWrite(name, rawInput, invocationId);
  }
  const input = definition.inputSchema.parse(rawInput ?? {});
  switch (name) {
    case "get_today_overview":
      return readTodayOverview();
    case "get_routines":
      return readRoutines(input as { includeArchived: boolean });
    case "get_week_plan":
      return readWeekPlan(input as { weekOf?: string; librarySearch?: string });
    case "get_grocery_list":
      return readGroceryList();
    case "get_money_overview":
      return readMoneyOverview(input as { eventsBefore?: string });
    case "get_household":
      return readHousehold();
    default:
      throw new Error(`Unhandled assistant read tool: ${name}`);
  }
}
