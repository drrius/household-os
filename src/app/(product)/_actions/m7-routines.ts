"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { parseRoutineForm } from "@/lib/forms/routine";
import {
  createRoutine,
  pauseRoutine,
  unpauseRoutine,
  archiveRoutine,
  updateRoutineDefinition,
} from "@/lib/routines/commands";

export async function createRoutineAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await createRoutine(parseRoutineForm(formData));
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}

export async function updateRoutineAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const routineId = uuidSchema.parse(formData.get("routineId"));
    const parsed = parseRoutineForm(formData);
    await updateRoutineDefinition({
      routineId,
      ...parsed,
      expectedUpdatedAt: z.iso
        .datetime({ offset: true })
        .parse(formData.get("expectedUpdatedAt")),
      idempotencyKey: z.string().uuid().parse(formData.get("idempotencyKey")),
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}

export async function routineLifecycleAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const routineId = uuidSchema.parse(formData.get("routineId"));
    const intent = z
      .enum(["pause", "resume", "archive"])
      .parse(formData.get("intent"));
    if (intent === "pause") await pauseRoutine(routineId);
    if (intent === "resume") await unpauseRoutine(routineId);
    if (intent === "archive") await archiveRoutine(routineId);
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}
