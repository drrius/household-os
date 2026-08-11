import "server-only";

import { callMoneyRpc } from "./rpc";

export type ConfirmExpenseDraftInput = {
  draftId: string;
  idempotencyKey: string;
  amountCents?: number | null;
  payerMemberId?: string | null;
  allocations?: unknown;
  occurredOn?: string | null;
  categoryId?: string | null;
  note?: string | null;
  receiptPath?: string | null;
};

export async function confirmExpenseDraft(
  input: ConfirmExpenseDraftInput,
): Promise<Record<string, unknown>> {
  return callMoneyRpc("confirm_expense_draft", () => ({
    p_draft_id: input.draftId,
    p_idempotency_key: input.idempotencyKey,
    p_amount_cents: input.amountCents ?? null,
    p_payer_member_id: input.payerMemberId ?? null,
    p_allocations: input.allocations ?? null,
    p_occurred_on: input.occurredOn ?? null,
    p_category_id: input.categoryId ?? null,
    p_note: input.note ?? null,
    p_receipt_path: input.receiptPath ?? null,
  }));
}

export async function dismissExpenseDraft(input: {
  draftId: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  return callMoneyRpc("dismiss_expense_draft", () => ({
    p_draft_id: input.draftId,
    p_idempotency_key: input.idempotencyKey,
  }));
}
