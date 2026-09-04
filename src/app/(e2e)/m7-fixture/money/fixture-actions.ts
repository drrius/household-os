"use server";
import { notFound } from "next/navigation";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { parseRefundForm } from "@/lib/forms/money-refund";
import { parseRecurringRuleForm } from "@/lib/forms/money-recurring";
import { parseExpenseForm, parseOpeningBalanceForm } from "@/lib/forms/money";
import { detail, members } from "@/app/(e2e)/m7-fixture/money/fixture-data";

export async function fixtureMoneyAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    (await settleFormAction(previous, form, async () => {
      if (form.get("correctionMode") === "opening")
        parseOpeningBalanceForm(form);
      else if (form.has("refundSplit")) parseRefundForm(form, detail.remaining);
      else if (form.has("scheduleKind"))
        parseRecurringRuleForm(form, [members[0].user_id, members[1].user_id]);
      else parseExpenseForm(form, [members[0].user_id, members[1].user_id]);
      throw new Error("Validated. This fixture does not post to a household.");
    })) ?? { submissionId: previous.submissionId + 1 }
  );
}
