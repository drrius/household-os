import "server-only";
import { loadMoneyEvent } from "@/lib/read-models/money-event";
import { loadMoneyDraft } from "@/lib/read-models/money-draft";
import { moneyDetailSchemas } from "./definitions/money-detail-tools";
export async function readMoneyDetail(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_financial_event") {
    const value = await loadMoneyEvent(
      moneyDetailSchemas.get_financial_event.parse(input).eventId,
    );
    if (!value) throw new Error("This financial event is unavailable.");
    return value;
  }
  const draft = await loadMoneyDraft(
    moneyDetailSchemas.get_expense_draft.parse(input).draftId,
  );
  if (!draft) throw new Error("This pending expense draft is unavailable.");
  return { draft };
}
