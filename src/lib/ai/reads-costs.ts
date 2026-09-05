import "server-only";
import { loadCostContext } from "@/lib/connected/cost-context";
import { loadCostRecord } from "@/lib/connected/cost-records";
import {
  loadAssociationExpense,
  loadAssociationExpenses,
} from "@/lib/connected/cost-associations";
import { costReadSchemas } from "./definitions/cost-tools";

export async function readCostTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_context_costs") {
    const { target, before } = costReadSchemas.get_context_costs.parse(input);
    const context = await loadCostRecord(target);
    if (!context) throw new Error("This cost context is unavailable.");
    return {
      ...context,
      costs: await loadCostContext(target.kind, target.id, {
        before,
        bookingId: target.bookingId,
      }),
    };
  }
  if (name === "get_expense_association") {
    const { eventId } = costReadSchemas.get_expense_association.parse(input);
    const value = await loadAssociationExpense(eventId);
    if (!value) throw new Error("This expense is unavailable.");
    return value;
  }
  const { before } = costReadSchemas.get_association_expenses.parse(input);
  return loadAssociationExpenses(before);
}
