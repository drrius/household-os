import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { assignExpenseContext } from "@/lib/connected/cost-associations";
import { loadCostRecord } from "@/lib/connected/cost-records";
import { postContextualExpense } from "@/lib/connected/context-expense-command";
import {
  associationSchema,
  contextualExpenseSchema,
} from "../definitions/cost-tools";
import { resolveAllocations } from "./allocations";
import { invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";

export const COST_HANDLERS: Record<string, AiWriteHandler> = {
  record_contextual_expense: async (input, { idempotencyKey }) => {
    const value = contextualExpenseSchema.parse(input);
    const context = await loadCostRecord(value.target);
    if (
      !context ||
      context.record.title !== value.contextTitle ||
      (context.booking?.title ?? null) !== value.bookingTitle
    )
      throw new Error(
        "This expense context changed. Read it again and request approval with the current titles.",
      );
    return postContextualExpense({
      description: value.description,
      amountCents: value.amountCents,
      payerMemberId: value.payerMemberId,
      allocations: await resolveAllocations(
        value.split,
        value.amountCents,
        value.payerMemberId,
      ),
      occurredOn: value.occurredOn,
      categoryId: value.categoryId ?? null,
      note: value.note ?? null,
      idempotencyKey,
      contextKind: value.target.kind,
      contextId: value.target.id,
      bookingId: value.target.bookingId,
    });
  },
  assign_expense_context: async (input, { idempotencyKey }) => {
    const value = associationSchema.parse(input);
    const { householdId } = await requireMemberContext();
    await assignExpenseContext({
      ...value,
      requestId: invocationRecordId(`${householdId}:${idempotencyKey}`),
    });
    return { done: true };
  },
};
