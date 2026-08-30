import "server-only";

import {
  resolveAllocations,
  type ExpenseSplit,
} from "@/lib/ai/execute/allocations";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
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
  record_settlement: (input, { idempotencyKey, today }) => {
    const value = input as {
      payerMemberId: string;
      amountCents: number;
      mode: "full" | "partial";
      description: string;
      occurredOn?: string;
      note?: string | null;
    };
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
      amountCents?: number | null;
      payerMemberId?: string | null;
      split?: ExpenseSplit | null;
      occurredOn?: string | null;
      categoryId?: string | null;
      note?: string | null;
    };
    let allocations = null;
    if (value.split != null) {
      if (value.amountCents == null || value.payerMemberId == null) {
        throw new Error(
          "Overriding the split also requires amountCents and payerMemberId",
        );
      }
      allocations = await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      );
    }
    return confirmExpenseDraft({
      draftId: value.draftId,
      idempotencyKey: `confirm-expense-draft:${value.draftId}`,
      amountCents: value.amountCents ?? null,
      payerMemberId: value.payerMemberId ?? null,
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
