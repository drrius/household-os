import "server-only";

import { callMoneyRpc } from "./rpc";

export { confirmExpenseDraft, dismissExpenseDraft } from "./draft-commands";
export {
  createRecurringExpenseRule,
  generateDueRecurringDrafts,
  setRecurringExpenseRuleActive,
} from "./recurring-commands";
export type { ConfirmExpenseDraftInput } from "./draft-commands";
export type { CreateRecurringExpenseRuleInput } from "./recurring-commands";

export type MoneyAllocationInput = {
  memberId: string;
  allocatedCents: number;
};

type HouseholdCommand = {
  householdId?: string;
  idempotencyKey: string;
};

export async function establishOpeningBalance(
  input: HouseholdCommand & {
    creditorMemberId: string;
    amountCents: number;
    occurredOn: string;
    description: string;
    note?: string | null;
  },
): Promise<Record<string, unknown>> {
  return callMoneyRpc("establish_opening_balance", (householdId) => ({
    p_household_id: input.householdId ?? householdId,
    p_creditor_member_id: input.creditorMemberId,
    p_amount_cents: input.amountCents,
    p_occurred_on: input.occurredOn,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
  }));
}

export async function postManualExpense(
  input: HouseholdCommand & {
    description: string;
    amountCents: number;
    payerMemberId: string;
    allocations: readonly MoneyAllocationInput[];
    occurredOn: string;
    categoryId?: string | null;
    note?: string | null;
    receiptPath?: string | null;
  },
): Promise<Record<string, unknown>> {
  return callMoneyRpc("post_manual_expense", (householdId) => ({
    p_household_id: input.householdId ?? householdId,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_category_id: input.categoryId ?? null,
    p_note: input.note ?? null,
    p_receipt_path: input.receiptPath ?? null,
  }));
}

export async function postRefund(input: {
  relatedEventId: string;
  amountCents: number;
  allocations: readonly MoneyAllocationInput[];
  occurredOn: string;
  idempotencyKey: string;
  description: string;
  note?: string | null;
}): Promise<Record<string, unknown>> {
  return callMoneyRpc("post_refund", () => ({
    p_related_event_id: input.relatedEventId,
    p_amount_cents: input.amountCents,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_description: input.description,
    p_note: input.note ?? null,
  }));
}

export async function recordSettlement(
  input: HouseholdCommand & {
    payerMemberId: string;
    amountCents: number;
    occurredOn: string;
    description: string;
    note?: string | null;
  },
): Promise<Record<string, unknown>> {
  return callMoneyRpc("record_settlement", (householdId) => ({
    p_household_id: input.householdId ?? householdId,
    p_payer_member_id: input.payerMemberId,
    p_amount_cents: input.amountCents,
    p_occurred_on: input.occurredOn,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
  }));
}

export type FinancialEventReplacement = {
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: readonly MoneyAllocationInput[];
  occurredOn: string;
  categoryId?: string | null;
  note?: string | null;
  receiptPath?: string | null;
};

function replacementPayload(
  replacement: FinancialEventReplacement | null | undefined,
): Record<string, unknown> | null {
  if (!replacement) {
    return null;
  }
  return {
    description: replacement.description,
    amount_cents: replacement.amountCents,
    payer_member_id: replacement.payerMemberId,
    allocations: replacement.allocations,
    occurred_on: replacement.occurredOn,
    category_id: replacement.categoryId ?? null,
    note: replacement.note ?? null,
    receipt_path: replacement.receiptPath ?? null,
  };
}

export async function correctFinancialEvent(input: {
  eventId: string;
  idempotencyKey: string;
  replacement?: FinancialEventReplacement | null;
}): Promise<Record<string, unknown>> {
  return callMoneyRpc("correct_financial_event", () => ({
    p_event_id: input.eventId,
    p_idempotency_key: input.idempotencyKey,
    p_replacement: replacementPayload(input.replacement),
  }));
}
