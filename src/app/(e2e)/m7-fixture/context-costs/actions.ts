"use server";
import { notFound, redirect } from "next/navigation";
import { formRejection, type FormActionState } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
import { parseExpenseForm } from "@/lib/forms/money";
export async function fixtureCostExpense(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  parseExpenseForm(form, [
    "00000000-0000-4000-8000-000000000011",
    "00000000-0000-4000-8000-000000000012",
  ]);
  if (form.get("note") !== "Retry")
    return formRejection(
      previous,
      new Error("Connection interrupted. Keep these details and retry."),
      echoValues(form),
    );
  redirect("/m7-fixture/context-costs?saved=1");
}
