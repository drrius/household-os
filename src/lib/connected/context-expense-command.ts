import "server-only";
import { z } from "zod";
import { isHouseholdAttachment } from "@/domain/attachments/files";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import type { ExpenseFormValue } from "@/lib/forms/money";
import type { CostContextKind } from "./cost-context";

export type ContextExpenseInput = ExpenseFormValue & {
  contextKind: CostContextKind;
  contextId: string;
  bookingId?: string | null;
  receiptPath?: string | null;
};
export async function postContextualExpense(
  input: ContextExpenseInput,
): Promise<{ eventId: string }> {
  const member = await requireMemberContext();
  const contextKind = z
    .enum(["project", "asset", "commitment"])
    .parse(input.contextKind);
  const contextId = z.uuid().parse(input.contextId);
  const bookingId = input.bookingId ? z.uuid().parse(input.bookingId) : null;
  if (bookingId && contextKind !== "project")
    throw new Error("Bookings can only belong to a project expense.");
  const receiptPath = input.receiptPath || null;
  if (
    receiptPath &&
    (!isHouseholdAttachment(receiptPath, member.householdId) ||
      receiptPath.split("/")[1] !== "receipts")
  )
    throw new Error("Upload a receipt for this household first.");
  const db = await createClient();
  const { data, error } = await db.rpc("post_contextual_expense", {
    p_household_id: member.householdId,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_context_kind: contextKind,
    p_context_id: contextId,
    p_category_id: input.categoryId,
    p_note: input.note,
    p_receipt_path: receiptPath,
    p_booking_id: bookingId,
  });
  if (error) {
    if (error.code === "22023")
      throw new Error(
        "Couldn't post this expense. Its details or context changed, or the record is archived. Check the existing costs before retrying.",
      );
    if (error.code === "42501")
      throw new Error(
        "This expense context is unavailable for your household.",
      );
    throw new Error(
      "Couldn't confirm this expense. Retry with the same details to avoid a duplicate.",
    );
  }
  const parsed = z.object({ event_id: z.uuid() }).safeParse(data);
  if (!parsed.success)
    throw new Error(
      "Couldn't confirm this expense. Retry with the same details to avoid a duplicate.",
    );
  return { eventId: parsed.data.event_id };
}
