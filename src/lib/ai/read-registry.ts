import "server-only";
import { readAttachmentTool } from "./attachments";
import { attachmentSchemas } from "./definitions/attachment-tools";
import { readGroceryCategories } from "./reads-categories";
import { moneyDetailSchemas } from "./definitions/money-detail-tools";
import { readMoneyDetail } from "./reads-money-details";
import { notificationSchemas } from "./definitions/notification-tools";
import { readNotificationTool } from "./reads-notifications";
import { dailyDetailSchemas } from "./definitions/daily-detail-tools";
import { readDailyDetail } from "./reads-daily-details";
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
import {
  readGroceryList,
  readHousehold,
  readRoutines,
  readTodayOverview,
  readWeekPlan,
} from "@/lib/ai/reads";
import { readMoneyOverview } from "@/lib/ai/reads-money";

type ReadHandler = (input: unknown) => Promise<Record<string, unknown>>;
function group(
  schemas: Record<string, unknown>,
  read: (name: string, input: unknown) => Promise<Record<string, unknown>>,
): Record<string, ReadHandler> {
  return Object.fromEntries(
    Object.keys(schemas)
      .filter((name) => getAiToolDefinition(name)?.kind === "read")
      .map((name) => [name, (input: unknown) => read(name, input)]),
  );
}
export const AI_READ_HANDLERS: Record<string, ReadHandler> = {
  ...group(attachmentSchemas, readAttachmentTool),
  ...group(moneyDetailSchemas, readMoneyDetail),
  ...group(notificationSchemas, readNotificationTool),
  ...group(dailyDetailSchemas, readDailyDetail),
  ...group(groceryDetailSchemas, readGroceryHistory),
  ...group(librarySchemas, readLibraryTool),
  ...group(projectDetailSchemas, readProjectDetail),
  ...group(costReadSchemas, readCostTool),
  ...group(connectedReadSchemas, readConnectedTool),
  list_icloud_calendars: async () => ({
    calendars: await listConnectedCalendars(),
  }),
  get_today_overview: () => readTodayOverview(),
  get_routines: (input) =>
    readRoutines(input as Parameters<typeof readRoutines>[0]),
  get_week_plan: (input) =>
    readWeekPlan(input as Parameters<typeof readWeekPlan>[0]),
  get_grocery_categories: readGroceryCategories,
  get_grocery_list: () => readGroceryList(),
  get_recurring_expense_rules: async () => ({
    rules: await loadRecurringRules(),
  }),
  get_money_overview: (input) =>
    readMoneyOverview(input as Parameters<typeof readMoneyOverview>[0]),
  get_household: () => readHousehold(),
};
