"use server";
import { notFound, redirect } from "next/navigation";
import { formRejection, type FormActionState } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
export async function fixtureAssociation(
  outcome: string,
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  if (outcome !== "success")
    return formRejection(
      previous,
      new Error(
        `Partner changed this association. Original revision: ${form.get("expectedRevision")}`,
      ),
      echoValues(form),
    );
  redirect("/m7-fixture/associations?mode=saved");
}
