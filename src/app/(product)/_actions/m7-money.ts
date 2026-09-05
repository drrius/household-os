"use server";

import { redirect } from "next/navigation";

import {
  loadHouseholdMembers,
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { requireMemberContext } from "@/lib/auth/member-context";
import { validateReceiptPath } from "@/lib/money/receipt";
import { settlementAmount } from "@/domain/money/settlements";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  parseExpenseForm,
  parseOpeningBalanceForm,
  parseSettlementForm,
} from "@/lib/forms/money";
import { loadSettlementContext } from "@/lib/forms/options";
import {
  confirmExpenseDraft,
  establishOpeningBalance,
  postManualExpense,
  recordSettlement,
} from "@/lib/money/commands";

export async function createExpenseAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const draftValue = formData.get("draftId");
    const draftId =
      typeof draftValue === "string" && draftValue.length > 0
        ? draftValue
        : null;
    const members = await loadHouseholdMembers();
    const member = await requireMemberContext();
    const receiptPath = validateReceiptPath(
      formData.get("receiptPath"),
      member.householdId,
    );
    const input = parseExpenseForm(formData, [
      members[0].user_id,
      members[1].user_id,
    ]);
    if (draftId !== null) {
      await confirmExpenseDraft({
        draftId: uuidSchema.parse(draftId),
        idempotencyKey: input.idempotencyKey,
        amountCents: input.amountCents,
        payerMemberId: input.payerMemberId,
        allocations: input.allocations,
        occurredOn: input.occurredOn,
        categoryId: input.categoryId,
        note: input.note,
        receiptPath,
      });
      return;
    }
    await postManualExpense({ ...input, receiptPath });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function establishOpeningBalanceAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const members = await loadHouseholdMembers();
    const input = parseOpeningBalanceForm(formData);
    if (!members.some((member) => member.user_id === input.creditorMemberId)) {
      throw new Error("Choose a household member as creditor.");
    }
    await establishOpeningBalance({ ...input, description: "Opening balance" });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function recordSettlementAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const input = parseSettlementForm(formData);
    const settlement = await loadSettlementContext();
    if (settlement === null) {
      throw new Error("The household is already settled up.");
    }
    const amountCents = settlementAmount({
      outstandingCents: settlement.outstandingCents,
      mode: input.mode,
      requestedCents: input.amountCents,
    });
    await recordSettlement({
      payerMemberId: settlement.debtorMemberId,
      amountCents,
      occurredOn: input.occurredOn,
      description: `${settlement.debtorName} paid ${settlement.creditorName}`,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
      mode: input.mode,
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}
