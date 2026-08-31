import "server-only";

import {
  resolveAllocations,
  type ExpenseSplit,
} from "@/lib/ai/execute/allocations";
import {
  readDraftSnapshot,
  readEventAllocations,
  readEventSnapshot,
  readOutstandingDebtCents,
  readRefundUsage,
} from "@/lib/ai/execute/money-snapshots";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import {
  confirmExpenseDraft,
  correctFinancialEvent,
  establishOpeningBalance,
  postManualExpense,
  postRefund,
  recordSettlement,
} from "@/lib/money/commands";

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
  record_refund: async (input, { idempotencyKey, today }) => {
    const value = input as {
      relatedEventId: string;
      originalDescription: string;
      payerMemberId: string;
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
    // The ledger derives the refund's payer from the source event; the
    // echoed payer binds the approval card to that reality.
    const source = await readEventSnapshot(value.relatedEventId);
    if (source.payerMemberId !== value.payerMemberId) {
      throw new Error(
        "payerMemberId must match the original event's payer (see get_money_overview)",
      );
    }
    if (source.description !== value.originalDescription) {
      throw new Error(
        "originalDescription must match the refunded event (see get_money_overview)",
      );
    }
    // Mirroring the original shares: cumulative refunds (net of reversed
    // ones) can neither exceed the original amount nor any member's
    // original share, and a corrected (reversed) source is not refundable.
    const usage = await readRefundUsage(value.relatedEventId);
    if (usage.sourceReversed) {
      throw new Error(
        "this event was corrected (reversed); refund its replacement instead (see get_money_overview)",
      );
    }
    const remaining = source.amountCents - usage.refundedCents;
    if (value.amountCents > remaining) {
      throw new Error(
        `only ${formatCentimesAsFrancs(Math.max(remaining, 0))} of this event remains refundable`,
      );
    }
    const sourceShares = await readEventAllocations(value.relatedEventId);
    for (const share of value.split.allocations) {
      const cap =
        (sourceShares.get(share.memberId) ?? 0) -
        (usage.refundedByMember.get(share.memberId) ?? 0);
      if (share.allocatedCents > cap) {
        throw new Error(
          "refund allocations must mirror the original shares: each member at most their remaining original allocation (see get_money_overview)",
        );
      }
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
    // Always post as partial: inside the ledger lock the RPC then posts
    // exactly the approved amount or rejects it, so a balance change
    // between approval and execution can never alter what is recorded.
    return recordSettlement({
      payerMemberId: value.payerMemberId,
      amountCents: value.amountCents,
      occurredOn: value.occurredOn ?? today,
      description: value.description,
      idempotencyKey,
      note: value.note ?? null,
      mode: "partial",
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
      description: string;
      amountCents: number;
      payerMemberId: string;
      split?: ExpenseSplit | null;
      occurredOn?: string | null;
      categoryId?: string | null;
      note?: string | null;
    };
    const draft = await readDraftSnapshot(value.draftId);
    // The echoed description binds the approval card to the stored draft,
    // so two same-amount drafts cannot present identical cards.
    if (draft.description !== value.description) {
      throw new Error(
        "description must match the stored draft (see get_money_overview)",
      );
    }
    let allocations = null;
    if (value.split != null) {
      allocations = await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      );
    } else if (draft.amountCents !== value.amountCents) {
      // Without a new split the draft's stored allocations post as-is;
      // they only sum correctly for the draft's own amount.
      throw new Error(
        `Changing the draft amount (${formatCentimesAsFrancs(draft.amountCents)} → ${formatCentimesAsFrancs(value.amountCents)}) also requires a split`,
      );
    } else if (draft.payerMemberId !== value.payerMemberId) {
      // The stored allocations gave the odd centime to the original payer.
      throw new Error("Changing the draft payer also requires a split");
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
      originalDescription: string;
      originalAmountCents: number;
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
    // The echoed original binds the approval card to the event actually
    // being reversed; refuse when it drifted from the ledger.
    const original = await readEventSnapshot(value.eventId);
    if (
      original.description !== value.originalDescription ||
      original.amountCents !== value.originalAmountCents
    ) {
      throw new Error(
        "originalDescription/originalAmountCents must match the event being corrected (see get_money_overview)",
      );
    }
    if (replacement === null) {
      return correctFinancialEvent({
        eventId: value.eventId,
        idempotencyKey,
        replacement: null,
      });
    }
    // The RPC only accepts replacements for expenses (or replacements of
    // expenses); fail with guidance instead of its constraint error.
    if (original.type !== "expense" && original.type !== "replacement") {
      throw new Error(
        `a ${original.type} cannot be replaced; propose a reversal without a replacement, then record the corrected event with its own tool`,
      );
    }
    // A correction that only changes one field must not lose the rest:
    // omitted category/note keep the original's values (null clears), and
    // the receipt always carries over since the tool cannot set one.
    return correctFinancialEvent({
      eventId: value.eventId,
      idempotencyKey,
      replacement: {
        description: replacement.description,
        amountCents: replacement.amountCents,
        payerMemberId: replacement.payerMemberId,
        allocations: await resolveAllocations(
          replacement.split,
          replacement.amountCents,
          replacement.payerMemberId,
        ),
        occurredOn: replacement.occurredOn,
        categoryId:
          replacement.categoryId === undefined
            ? original.categoryId
            : replacement.categoryId,
        note: replacement.note === undefined ? original.note : replacement.note,
        receiptPath: original.receiptPath,
      },
    });
  },
};
