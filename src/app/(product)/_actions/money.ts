"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import {
  loadHouseholdMembers,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { parseExpenseForm, parseOpeningBalanceForm } from "@/lib/forms/money";
import { parseRefundForm } from "@/lib/forms/money-refund";
import {
  correctFinancialEvent,
  postRefund,
  confirmExpenseDraft,
  dismissExpenseDraft,
} from "@/lib/money/commands";
import { loadMoneyEvent } from "@/lib/read-models/money-event";

export async function confirmDraftAction(formData: FormData): Promise<void> {
  const draftId = z.string().uuid().parse(formData.get("draftId"));
  await confirmExpenseDraft({
    draftId,
    idempotencyKey: `confirm-expense-draft:${draftId}`,
  });
  revalidateProduct(["/", "/money", "/home"]);
}

export async function dismissDraftAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, form, async () => {
    await dismissExpenseDraft({
      draftId: z.string().uuid().parse(form.get("draftId")),
      idempotencyKey: z.string().uuid().parse(form.get("idempotencyKey")),
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function correctEventAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let destination = "/money";
  const rejected = await settleFormAction(previous, form, async () => {
    const eventId = z.string().uuid().parse(form.get("eventId"));
    const idempotencyKey = z.string().uuid().parse(form.get("idempotencyKey"));
    const members = await loadHouseholdMembers();
    const mode = z
      .enum(["reverse", "replace", "opening"])
      .parse(form.get("correctionMode"));
    const opening = mode === "opening" ? parseOpeningBalanceForm(form) : null;
    const replacement =
      mode === "reverse"
        ? null
        : opening
          ? {
              description: "Opening balance correction",
              amountCents: opening.amountCents,
              payerMemberId: opening.creditorMemberId,
              allocations: null,
              occurredOn: opening.occurredOn,
              note: opening.note,
            }
          : {
              ...parseExpenseForm(form, [
                members[0].user_id,
                members[1].user_id,
              ]),
              receiptPath: z.string().nullable().parse(form.get("receiptPath")),
            };
    const result = await correctFinancialEvent({
      eventId,
      idempotencyKey,
      replacement,
    });
    const id = z
      .string()
      .uuid()
      .parse(result.replacement_event_id ?? result.reversal_event_id);
    destination = `/money/events/${id}`;
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect(destination);
}

export async function refundEventAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let destination = "/money";
  const rejected = await settleFormAction(previous, form, async () => {
    const detail = await loadMoneyEvent(
      z.string().uuid().parse(form.get("eventId")),
    );
    if (!detail || !["expense", "replacement"].includes(detail.event.type))
      throw new Error("Choose an expense to refund.");
    // Parse against immutable original shares so a successful retry reaches RPC idempotency.
    // The RPC checks the current remaining shares under the source event lock.
    const input = parseRefundForm(
      form,
      detail.allocations.map((share) => ({
        memberId: share.member_id,
        allocatedCents: share.allocated_cents,
      })),
    );
    const result = await postRefund(input);
    destination = `/money/events/${z.string().uuid().parse(result.financial_event_id)}`;
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect(destination);
}
