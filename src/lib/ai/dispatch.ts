import "server-only";
import { groceryDetailSchemas } from "./definitions/grocery-detail-tools";
import { readGroceryHistory } from "./reads-grocery-history";
import { librarySchemas } from "./definitions/library-tools";
import { readLibraryTool } from "./reads-library";
import { loadRecurringRules } from "@/lib/read-models/money-recurring";
import { projectDetailSchemas } from "./definitions/project-detail-tools";
import { readProjectDetail } from "./reads-project-details";
import { costReadSchemas } from "./definitions/cost-tools";
import { readCostTool } from "./reads-costs";
import { listConnectedCalendars } from "@/lib/calendar/connection";
import { connectedReadSchemas } from "./definitions/connected-read-tools";
import { readConnectedTool } from "./reads-connected";

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
  if (Object.hasOwn(groceryDetailSchemas, name))
    return readGroceryHistory(name, input);
  if (Object.hasOwn(librarySchemas, name)) return readLibraryTool(name, input);
  if (Object.hasOwn(projectDetailSchemas, name))
    return readProjectDetail(name, input);
  if (Object.hasOwn(costReadSchemas, name)) return readCostTool(name, input);
  if (Object.hasOwn(connectedReadSchemas, name))
    return readConnectedTool(name, input);
  switch (name) {
    case "list_icloud_calendars":
      return { calendars: await listConnectedCalendars() };
    case "get_today_overview":
      return readTodayOverview();
    case "get_routines":
      return readRoutines(input as { includeArchived: boolean });
    case "get_week_plan":
      return readWeekPlan(input as { weekOf?: string; librarySearch?: string });
    case "get_grocery_list":
      return readGroceryList();
    case "get_recurring_expense_rules":
      return { rules: await loadRecurringRules() };
    case "get_money_overview":
      return readMoneyOverview(input as { eventsBefore?: string });
    case "get_household":
      return readHousehold();
    default:
      throw new Error(`Unhandled assistant read tool: ${name}`);
  }
}
