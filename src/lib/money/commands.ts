import "server-only";
import { moneyCommandError } from "@/lib/money/command-error";

import { shoppingDraftReceipt, validateReceiptPath } from "@/lib/money/receipt";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export type MoneyAllocationInput = {
  memberId: string;
  allocatedCents: number;
};

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

export type CreateRecurringExpenseRuleInput = {
  householdId?: string;
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: unknown;
  schedule:
    | { kind: "weekly"; isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
    | { kind: "monthly"; dayOfMonth: number };
  nextOccurrenceOn: string;
  idempotencyKey: string;
  categoryId?: string | null;
};

export type FinancialEventReplacement = {
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: readonly MoneyAllocationInput[] | null;
  occurredOn: string;
  categoryId?: string | null;
  note?: string | null;
  receiptPath?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Money command returned an unexpected payload");
}

export async function establishOpeningBalance(input: {
  householdId?: string;
  creditorMemberId: string;
  amountCents: number;
  occurredOn: string;
  description: string;
  idempotencyKey: string;
  note?: string | null;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("establish_opening_balance", {
    p_household_id: input.householdId ?? member.householdId,
    p_creditor_member_id: input.creditorMemberId,
    p_amount_cents: input.amountCents,
    p_occurred_on: input.occurredOn,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
  });

  if (error) {
    throw new Error(`establish_opening_balance failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function postManualExpense(input: {
  householdId?: string;
  description: string;
  amountCents: number;
  payerMemberId: string;
  allocations: readonly MoneyAllocationInput[];
  occurredOn: string;
  idempotencyKey: string;
  categoryId?: string | null;
  note?: string | null;
  receiptPath?: string | null;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_manual_expense", {
    p_household_id: input.householdId ?? member.householdId,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_category_id: input.categoryId ?? null,
    p_note: input.note ?? null,
    p_receipt_path: validateReceiptPath(input.receiptPath, member.householdId),
  });

  if (error) {
    throw new Error(`post_manual_expense failed: ${error.message}`);
  }

  return asRecord(data);
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
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("post_refund", {
    p_related_event_id: input.relatedEventId,
    p_amount_cents: input.amountCents,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_description: input.description,
    p_note: input.note ?? null,
  });

  if (error) {
    throw moneyCommandError("post_refund", error);
  }

  return asRecord(data);
}

export async function recordSettlement(input: {
  householdId?: string;
  payerMemberId: string;
  amountCents: number;
  occurredOn: string;
  description: string;
  idempotencyKey: string;
  note?: string | null;
  mode: "full" | "partial";
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_settlement", {
    p_household_id: input.householdId ?? member.householdId,
    p_payer_member_id: input.payerMemberId,
    p_amount_cents: input.amountCents,
    p_occurred_on: input.occurredOn,
    p_description: input.description,
    p_idempotency_key: input.idempotencyKey,
    p_note: input.note ?? null,
    p_mode: input.mode,
  });

  if (error) {
    throw new Error(`record_settlement failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function correctFinancialEvent(input: {
  eventId: string;
  idempotencyKey: string;
  replacement?: FinancialEventReplacement | null;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const replacement = input.replacement;
  const { data, error } = await supabase.rpc("correct_financial_event", {
    p_event_id: input.eventId,
    p_idempotency_key: input.idempotencyKey,
    p_replacement: replacement
      ? {
          description: replacement.description,
          amount_cents: replacement.amountCents,
          payer_member_id: replacement.payerMemberId,
          allocations: replacement.allocations,
          occurred_on: replacement.occurredOn,
          category_id: replacement.categoryId ?? null,
          note: replacement.note ?? null,
          receipt_path: validateReceiptPath(
            replacement.receiptPath,
            member.householdId,
          ),
        }
      : null,
  });

  if (error) {
    throw moneyCommandError("correct_financial_event", error);
  }

  return asRecord(data);
}

export async function confirmExpenseDraft(
  input: ConfirmExpenseDraftInput,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const receiptPath =
    input.receiptPath === undefined
      ? await shoppingDraftReceipt(input.draftId, member.householdId)
      : validateReceiptPath(input.receiptPath, member.householdId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("confirm_expense_draft", {
    p_draft_id: input.draftId,
    p_idempotency_key: input.idempotencyKey,
    p_amount_cents: input.amountCents ?? null,
    p_payer_member_id: input.payerMemberId ?? null,
    p_allocations: input.allocations ?? null,
    p_occurred_on: input.occurredOn ?? null,
    p_category_id: input.categoryId ?? null,
    p_note: input.note ?? null,
    p_receipt_path: receiptPath,
  });

  if (error) {
    throw new Error(`confirm_expense_draft failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function dismissExpenseDraft(input: {
  draftId: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("dismiss_expense_draft", {
    p_draft_id: input.draftId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`dismiss_expense_draft failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function createRecurringExpenseRule(
  input: CreateRecurringExpenseRuleInput,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const schedule = input.schedule;
  const { data, error } = await supabase.rpc("create_recurring_expense_rule", {
    p_household_id: input.householdId ?? member.householdId,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_schedule_kind: schedule.kind,
    p_next_occurrence_on: input.nextOccurrenceOn,
    p_idempotency_key: input.idempotencyKey,
    p_iso_weekday: schedule.kind === "weekly" ? schedule.isoWeekday : null,
    p_day_of_month: schedule.kind === "monthly" ? schedule.dayOfMonth : null,
    p_category_id: input.categoryId ?? null,
  });

  if (error) {
    throw new Error(`create_recurring_expense_rule failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function setRecurringExpenseRuleActive(input: {
  ruleId: string;
  active: boolean;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc(
    "set_recurring_expense_rule_active",
    {
      p_rule_id: input.ruleId,
      p_active: input.active,
      p_idempotency_key: input.idempotencyKey,
    },
  );

  if (error) {
    throw new Error(
      `set_recurring_expense_rule_active failed: ${error.message}`,
    );
  }

  return asRecord(data);
}

export async function generateDueRecurringDrafts(input: {
  householdId?: string;
  asOf: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_due_recurring_drafts", {
    p_household_id: input.householdId ?? member.householdId,
    p_as_of: input.asOf,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`generate_due_recurring_drafts failed: ${error.message}`);
  }

  return asRecord(data);
}
