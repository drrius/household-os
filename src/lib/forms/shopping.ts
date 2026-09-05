import { z } from "zod";

import { parseChfToCentimes } from "@/domain/money/chf";
import { parseExpenseForm } from "@/lib/forms/money";

export function parseShoppingForm(
  formData: FormData,
  memberIds: readonly [string, string],
) {
  const shoppingSessionId = z.string().uuid().parse(formData.get("sessionId"));
  const occurredOn = z.iso.date().parse(formData.get("occurredOn"));
  const receiptText = formData.get("receiptTotal");
  const receiptTotalCents =
    typeof receiptText !== "string" || receiptText.trim() === ""
      ? null
      : parseChfToCentimes(receiptText);
  const createExpenseDraft = formData.get("createExpenseDraft") === "on";
  const expense = createExpenseDraft
    ? parseExpenseForm(formData, memberIds)
    : null;
  return {
    shoppingSessionId,
    occurredOn,
    receiptTotalCents,
    createExpenseDraft,
    idempotencyKey: `finish-shopping:${shoppingSessionId}`,
    expenseDescription: expense?.description ?? null,
    sharedAmountCents: expense?.amountCents ?? null,
    payerMemberId: expense?.payerMemberId ?? null,
    proposedAllocations: expense?.allocations ?? [],
  };
}
