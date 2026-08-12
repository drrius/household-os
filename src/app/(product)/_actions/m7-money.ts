"use server";

import { redirect } from "next/navigation";

import {
  errorHref,
  loadHouseholdMembers,
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { requireMemberContext } from "@/lib/auth/member-context";
import { settlementAmount } from "@/domain/money/settlements";
import {
  parseExpenseForm,
  parseOpeningBalanceForm,
  parseSettlementForm,
} from "@/lib/forms/m7";
import {
  confirmExpenseDraft,
  establishOpeningBalance,
  postManualExpense,
  recordSettlement,
} from "@/lib/money/commands";
import { createClient } from "@/lib/supabase/server";

export async function createExpenseAction(formData: FormData): Promise<void> {
  let failure: unknown = null;
  try {
    const members = await loadHouseholdMembers();
    const input = parseExpenseForm(formData, [
      members[0].user_id,
      members[1].user_id,
    ]);
    const draftValue = formData.get("draftId");
    if (typeof draftValue === "string" && draftValue.length > 0) {
      await confirmExpenseDraft({
        draftId: uuidSchema.parse(draftValue),
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
  if (failure !== null) redirect(errorHref("/money/expenses/new", failure));
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

export async function establishOpeningBalanceAction(
  formData: FormData,
): Promise<void> {
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
  if (failure !== null) redirect(errorHref("/money/opening-balance", failure));
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}

async function currentSettlement() {
  const actor = await requireMemberContext();
  const members = await loadHouseholdMembers();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("member_id, receivable_delta_cents")
    .eq("household_id", actor.householdId);
  if (error) throw new Error(`settlement_balance failed: ${error.message}`);
  const balance = new Map(members.map((member) => [member.user_id, 0]));
  for (const row of data ?? []) {
    const current = balance.get(row.member_id);
    if (
      current === undefined ||
      !Number.isSafeInteger(row.receivable_delta_cents)
    ) {
      throw new Error("The household balance could not be reconciled.");
    }
    const next = current + row.receivable_delta_cents;
    if (!Number.isSafeInteger(next))
      throw new Error("The balance is too large.");
    balance.set(row.member_id, next);
  }
  const debtor = members.find(
    (member) => (balance.get(member.user_id) ?? 0) < 0,
  );
  const creditor = members.find(
    (member) => (balance.get(member.user_id) ?? 0) > 0,
  );
  if (debtor === undefined || creditor === undefined) {
    throw new Error("The household is already settled up.");
  }
  return {
    debtor,
    creditor,
    outstanding: Math.abs(balance.get(debtor.user_id) ?? 0),
  };
}

export async function recordSettlementAction(
  formData: FormData,
): Promise<void> {
  const requestedMode = formData.get("mode") === "partial" ? "partial" : "full";
  let failure: unknown = null;
  try {
    const input = parseSettlementForm(formData);
    const { debtor, creditor, outstanding } = await currentSettlement();
    const amountCents = settlementAmount({
      outstandingCents: outstanding,
      mode: input.mode,
      requestedCents: input.amountCents,
    });
    await recordSettlement({
      payerMemberId: debtor.user_id,
      amountCents,
      occurredOn: input.occurredOn,
      description: `${debtor.display_name} paid ${creditor.display_name}`,
      idempotencyKey: input.idempotencyKey,
      note: input.note,
    });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    redirect(
      errorHref(`/money/settlements/new?mode=${requestedMode}`, failure),
    );
  }
  revalidateProduct(["/", "/money", "/home"]);
  redirect("/money");
}
