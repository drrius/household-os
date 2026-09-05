"use server";
import { redirect, unstable_rethrow } from "next/navigation";
import { z } from "zod";
import {
  costTargetHref,
  costTargetSchema,
  type CostTarget,
} from "@/domain/money/cost-target";
import { isHouseholdAttachment } from "@/domain/attachments/files";
import { requireMemberContext } from "@/lib/auth/member-context";
import { postContextualExpense } from "@/lib/connected/context-expense-command";
import { formRejection, type FormActionState } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
import { parseExpenseForm } from "@/lib/forms/money";
import {
  loadHouseholdMembers,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
export async function postContextExpenseAction(
  inputTarget: CostTarget,
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let target: CostTarget;
  try {
    target = costTargetSchema.parse(inputTarget);
    const [member, members] = await Promise.all([
      requireMemberContext(),
      loadHouseholdMembers(),
    ]);
    const input = parseExpenseForm(form, [
      members[0].user_id,
      members[1].user_id,
    ]);
    z.string().max(4000).nullable().parse(input.note);
    const receiptPath =
      z
        .string()
        .max(300)
        .parse(form.get("receiptPath") ?? "")
        .trim() || null;
    if (
      receiptPath &&
      (!isHouseholdAttachment(receiptPath, member.householdId) ||
        receiptPath.split("/")[1] !== "receipts")
    )
      throw new Error("Choose a receipt uploaded to this household.");
    await postContextualExpense({
      ...input,
      receiptPath,
      contextKind: target.kind,
      contextId: target.id,
      bookingId: target.bookingId,
    });
  } catch (failure) {
    unstable_rethrow(failure);
    return formRejection(previous, failure, echoValues(form));
  }
  revalidateProduct([
    "/",
    "/money",
    "/home",
    "/plan",
    "/money/contexts",
    `/money/contexts/${target.kind}/${target.id}`,
  ]);
  const href = costTargetHref(target);
  redirect(`${href}${target.bookingId ? "&" : "?"}saved=1`);
}
