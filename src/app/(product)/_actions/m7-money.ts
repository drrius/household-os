"use server";

import { redirect } from "next/navigation";

import {
  echoValues,
  loadHouseholdMembers,
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { settlementAmount } from "@/domain/money/settlements";
import { errorField } from "@/lib/forms/field-error";
import {
  formErrorMessage,
  parseExpenseForm,
  parseOpeningBalanceForm,
  parseSettlementForm,
} from "@/lib/forms/m7";
import { loadSettlementContext } from "@/lib/forms/options";
import {
  confirmExpenseDraft,
  establishOpeningBalance,
  postManualExpense,
  recordSettlement,
} from "@/lib/money/commands";
import type { FormActionResult } from "@/ui/forms/form-action";

function expenseEchoNames(formData: FormData): readonly string[] {
  const names = [
    "description",
    "amount",
    "occurredOn",
    "payerMemberId",
    "categoryId",
    "note",
    "splitMode",
  ];
  for (const key of formData.keys()) {
    if (key.startsWith("allocation:")) names.push(key);
  }
  return names;
}

export async function createExpenseAction(
  formData: FormData,
): Promise<FormActionResult> {
  const draftValue = formData.get("draftId");
  const draftId =
    typeof draftValue === "string" && draftValue.length > 0 ? draftValue : null;
  let failure: unknown = null;
  try {
    const members = await loadHouseholdMembers();
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
      });
    } else {
      await postManualExpense(input);
    }
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return {
      error: formErrorMessage(failure),
      field: errorField(failure),
      values: echoValues(formData, expenseEchoNames(formData)),
    };
  }
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function establishOpeningBalanceAction(
  formData: FormData,
): Promise<FormActionResult> {
  let failure: unknown = null;
  try {
    const members = await loadHouseholdMembers();
    const input = parseOpeningBalanceForm(formData);
    if (!members.some((member) => member.user_id === input.creditorMemberId)) {
      throw new Error("Choose a household member as creditor.");
    }
    await establishOpeningBalance({ ...input, description: "Opening balance" });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return {
      error: formErrorMessage(failure),
      field: errorField(failure),
      values: echoValues(formData, [
        "creditorMemberId",
        "amount",
        "occurredOn",
        "note",
      ]),
    };
  }
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function recordSettlementAction(
  formData: FormData,
): Promise<FormActionResult> {
  let failure: unknown = null;
  try {
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
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    // `occurredOn` is non-negotiable here: a back-dated settlement that
    // silently reverts to today needs a reversal plus a replacement event.
    return {
      error: formErrorMessage(failure),
      field: errorField(failure),
      values: echoValues(formData, ["mode", "amount", "occurredOn", "note"]),
    };
  }
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}
