"use server";

import { redirect } from "next/navigation";

import {
  errorHref,
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { parseRoutineForm } from "@/lib/forms/m7";
import {
  createRoutine,
  updateRoutineDefinition,
} from "@/lib/routines/commands";

export async function createRoutineAction(formData: FormData): Promise<void> {
  let failure: unknown = null;
  try {
    await createRoutine(parseRoutineForm(formData));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) redirect(errorHref("/home/routines/new", failure));
  revalidateProduct(["/", "/home"]);
  redirect("/home");
}

export async function updateRoutineAction(formData: FormData): Promise<void> {
  const routineIdValue = formData.get("routineId");
  const fallbackId = typeof routineIdValue === "string" ? routineIdValue : "";
  let failure: unknown = null;
  try {
    const routineId = uuidSchema.parse(routineIdValue);
    await updateRoutineDefinition({ routineId, ...parseRoutineForm(formData) });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    redirect(
      errorHref(
        `/home/routines/${encodeURIComponent(fallbackId)}/edit`,
        failure,
      ),
    );
  }
  revalidateProduct(["/", "/home"]);
  redirect("/home");
}
