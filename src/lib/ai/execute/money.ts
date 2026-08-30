import "server-only";

import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import type { LedgerEntry } from "@/domain/money/types";
import {
  resolveAllocations,
  type ExpenseSplit,
} from "@/lib/ai/execute/allocations";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import {
  confirmExpenseDraft,
  correctFinancialEvent,
  createRecurringExpenseRule,
  dismissExpenseDraft,
  establishOpeningBalance,
  postManualExpense,
  postRefund,
  recordSettlement,
  setRecurringExpenseRuleActive,
} from "@/lib/money/commands";

/**
 * The debtor's current outstanding amount, derived from the ledger exactly
 * like the money overview, so approvals can be checked against reality.
 */
async function readOutstandingDebtCents(
  payerMemberId: string,
): Promise<number> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("financial_event_id, member_id, receivable_delta_cents")
    .eq("household_id", member.householdId);
  if (error !== null || !Array.isArray(data)) {
    throw new Error(`ledger query failed: ${error?.message ?? "no data"}`);
  }
  const entries: LedgerEntry[] = (
    data as {
      financial_event_id: string;
      member_id: string;
      receivable_delta_cents: number;
    }[]
  ).map((row) => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
  const balance =
    deriveMemberBalances(entries).get(asMemberId(payerMemberId)) ?? 0;
  return -balance;
}

/** The stored draft values a confirmation must be checked against. */
async function readDraftSnapshot(
  draftId: string,
): Promise<{ amountCents: number; payerMemberId: string }> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_drafts")
    .select("amount_cents, payer_member_id")
    .eq("household_id", member.householdId)
    .eq("id", draftId)
    .single();
  if (error !== null) {
    throw new Error(`expense draft lookup failed: ${error.message}`);
  }
  const row = data as { amount_cents: number; payer_member_id: string };
  return { amountCents: row.amount_cents, payerMemberId: row.payer_member_id };
}

export const MONEY_DRAFT_HANDLERS: Record<string, AiWriteHandler> = {
  dismiss_expense_draft: (input) => {
    const value = input as { draftId: string };
    return dismissExpenseDraft({
      draftId: value.draftId,
      idempotencyKey: `dismiss-expense-draft:${value.draftId}`,
    });
  },
  create_recurring_expense_rule: async (input, { idempotencyKey }) => {
    const value = input as {
      description: string;
      amountCents: number;
      payerMemberId: string;
      split: ExpenseSplit;
      schedule:
        | { kind: "weekly"; isoWeekday: 1 | 2 | 3 | 4 | 5 | 6 | 7 }
        | { kind: "monthly"; dayOfMonth: number };
      nextOccurrenceOn: string;
      categoryId?: string | null;
    };
    return createRecurringExpenseRule({
      description: value.description,
      amountCents: value.amountCents,
      payerMemberId: value.payerMemberId,
      allocations: await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      ),
      schedule: value.schedule,
      nextOccurrenceOn: value.nextOccurrenceOn,
      idempotencyKey,
      categoryId: value.categoryId ?? null,
    });
  },
  set_recurring_expense_rule_active: (input, { idempotencyKey }) => {
    const value = input as { ruleId: string; active: boolean };
    return setRecurringExpenseRuleActive({
      ruleId: value.ruleId,
      active: value.active,
      idempotencyKey: `${idempotencyKey}:${value.active}`,
    });
  },
};

export const FINANCIAL_HANDLERS: Record<string, AiWriteHandler> = {
  record_expense: async (input, { idempotencyKey, today }) => {
    const value = input as {
      description: string;
      amountCents: number;
      payerMemberId: string;
      split: ExpenseSplit;
      occurredOn?: string;
      categoryId?: string | null;
      note?: string | null;
    };
    return postManualExpense({
      description: value.description,
      amountCents: value.amountCents,
      payerMemberId: value.payerMemberId,
      allocations: await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      ),
      occurredOn: value.occurredOn ?? today,
      idempotencyKey,
      categoryId: value.categoryId ?? null,
      note: value.note ?? null,
    });
  },
  record_refund: (input, { idempotencyKey, today }) => {
    const value = input as {
      relatedEventId: string;
      description: string;
      amountCents: number;
      split: ExpenseSplit;
      occurredOn?: string;
      note?: string | null;
    };
    if (value.split.kind === "equal") {
      throw new Error(
        "record_refund needs custom allocations mirroring the original expense shares",
      );
    }
    return postRefund({
      relatedEventId: value.relatedEventId,
      amountCents: value.amountCents,
      allocations: value.split.allocations,
      occurredOn: value.occurredOn ?? today,
      idempotencyKey,
      description: value.description,
      note: value.note ?? null,
    });
  },
  record_settlement: async (input, { idempotencyKey, today }) => {
    const value = input as {
      payerMemberId: string;
      amountCents: number;
      mode: "full" | "partial";
      description: string;
      occurredOn?: string;
      note?: string | null;
    };
    // A full settlement posts the balance recomputed in the transaction,
    // so refuse when it no longer matches the amount the member approved.
    if (value.mode === "full") {
      const outstanding = await readOutstandingDebtCents(value.payerMemberId);
      if (outstanding !== value.amountCents) {
        throw new Error(
          `The outstanding balance is ${formatCentimesAsFrancs(outstanding)}, not ${formatCentimesAsFrancs(value.amountCents)}; re-propose the settlement with the current amount`,
        );
      }
    }
    return recordSettlement({
      payerMemberId: value.payerMemberId,
      amountCents: value.amountCents,
      occurredOn: value.occurredOn ?? today,
      description: value.description,
      idempotencyKey,
      note: value.note ?? null,
      mode: value.mode,
    });
  },
  establish_opening_balance: (input, { idempotencyKey, today }) => {
    const value = input as {
      creditorMemberId: string;
      amountCents: number;
      description: string;
      occurredOn?: string;
      note?: string | null;
    };
    return establishOpeningBalance({
      creditorMemberId: value.creditorMemberId,
      amountCents: value.amountCents,
      occurredOn: value.occurredOn ?? today,
      description: value.description,
      idempotencyKey,
      note: value.note ?? null,
    });
  },
  confirm_expense_draft: async (input) => {
    const value = input as {
      draftId: string;
      amountCents: number;
      payerMemberId: string;
      split?: ExpenseSplit | null;
      occurredOn?: string | null;
      categoryId?: string | null;
      note?: string | null;
    };
    let allocations = null;
    if (value.split != null) {
      allocations = await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      );
    } else {
      // Without a new split the draft's stored allocations post as-is;
      // they only sum correctly for the draft's own amount.
      const draft = await readDraftSnapshot(value.draftId);
      if (draft.amountCents !== value.amountCents) {
        throw new Error(
          `Changing the draft amount (${formatCentimesAsFrancs(draft.amountCents)} → ${formatCentimesAsFrancs(value.amountCents)}) also requires a split`,
        );
      }
    }
    return confirmExpenseDraft({
      draftId: value.draftId,
      idempotencyKey: `confirm-expense-draft:${value.draftId}`,
      amountCents: value.amountCents,
      payerMemberId: value.payerMemberId,
      allocations,
      occurredOn: value.occurredOn ?? null,
      categoryId: value.categoryId ?? null,
      note: value.note ?? null,
    });
  },
  correct_financial_event: async (input, { idempotencyKey }) => {
    const value = input as {
      eventId: string;
      replacement?: {
        description: string;
        amountCents: number;
        payerMemberId: string;
        split: ExpenseSplit;
        occurredOn: string;
        categoryId?: string | null;
        note?: string | null;
      } | null;
    };
    const replacement = value.replacement ?? null;
    return correctFinancialEvent({
      eventId: value.eventId,
      idempotencyKey,
      replacement: replacement
        ? {
            description: replacement.description,
            amountCents: replacement.amountCents,
            payerMemberId: replacement.payerMemberId,
            allocations: await resolveAllocations(
              replacement.split,
              replacement.amountCents,
              replacement.payerMemberId,
            ),
            occurredOn: replacement.occurredOn,
            categoryId: replacement.categoryId ?? null,
            note: replacement.note ?? null,
          }
        : null,
    });
  },
};
