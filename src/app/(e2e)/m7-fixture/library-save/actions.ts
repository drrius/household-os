"use server";
import { readFixture, writeFixture } from "./store";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { FormActionState } from "@/lib/forms/action-state";
export async function saveFixture(
  run: string,
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const state = readFixture(run);
  let error: string | undefined;
  if (form.has("templateId")) {
    const id = String(form.get("templateId"));
    if (state.ids.includes(id)) error = "Duplicate grocery identity";
    else state.ids.push(id);
  } else if (
    form.get("version") !==
    `2026-09-05T00:00:${String(state.revision).padStart(2, "0")}Z`
  )
    error = "Stale meal version";
  else {
    state.revision++;
    state.name = String(form.get("name"));
  }
  if (error)
    return {
      submissionId: previous.submissionId + 1,
      error,
      values: Object.fromEntries(
        [...form].map(([key, value]) => [key, String(value)]),
      ),
    };
  writeFixture(run, state);
  revalidatePath("/m7-fixture/library-save");
  redirect(`/m7-fixture/library-save?run=${run}`);
}
