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
import { parseRecurringRuleForm } from "@/lib/forms/money-recurring";
import {
  createRecurringExpenseRule,
  setRecurringExpenseRuleActive,
} from "@/lib/money/commands";
import { updateRecurringExpenseRule } from "@/lib/money/recurring-commands";

export async function saveRecurringRuleAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, form, async () => {
    const members = await loadHouseholdMembers();
    const input = parseRecurringRuleForm(form, [
      members[0].user_id,
      members[1].user_id,
    ]);
    const ruleId = form.get("ruleId");
    if (ruleId)
      await updateRecurringExpenseRule({
        ...input,
        ruleId: z.string().uuid().parse(ruleId),
        expectedUpdatedAt: z.iso
          .datetime({ offset: true })
          .parse(form.get("expectedUpdatedAt")),
      });
    else await createRecurringExpenseRule(input);
  });
  if (rejected) return rejected;
  revalidateProduct(["/money", "/money/recurring", "/home"]);
  redirect("/money/recurring");
}

export async function toggleRecurringRuleAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, form, async () => {
    await setRecurringExpenseRuleActive({
      ruleId: z.string().uuid().parse(form.get("ruleId")),
      active: z.enum(["true", "false"]).parse(form.get("active")) === "true",
      idempotencyKey: z.string().uuid().parse(form.get("idempotencyKey")),
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/money", "/money/recurring", "/home"]);
  redirect("/money/recurring");
}
