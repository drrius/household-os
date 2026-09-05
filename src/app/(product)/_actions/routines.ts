"use server";

import {
  validateCompletionPhoto,
  validateRescheduleDate,
} from "@/lib/routines/occurrence-validation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { settleFormAction } from "@/lib/forms/action-state";
import { parseOccurrenceAction } from "@/lib/forms/routine-occurrence";

import { confirmExpenseDraft } from "@/lib/money/commands";
import {
  completeOccurrence,
  skipOccurrence,
  rescheduleOccurrence,
} from "@/lib/routines/commands";
import { zurichCivilDate } from "@/lib/ui/zurich-date";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requireUuid(value: string, label: string): string {
  if (!uuidPattern.test(value)) {
    throw new Error(`${label} must be a UUID`);
  }
  return value;
}

export async function completeRoutineOccurrence(
  occurrenceId: string,
): Promise<void> {
  const confirmedOccurrenceId = requireUuid(occurrenceId, "Occurrence ID");
  await completeOccurrence({
    occurrenceId: confirmedOccurrenceId,
    idempotencyKey: `complete-occurrence:${confirmedOccurrenceId}`,
    completedOn: zurichCivilDate(),
  });
  revalidatePath("/");
}

export async function confirmTodayExpenseDraft(draftId: string): Promise<void> {
  const confirmedDraftId = requireUuid(draftId, "Draft ID");
  await confirmExpenseDraft({
    draftId: confirmedDraftId,
    idempotencyKey: `confirm-expense-draft:${confirmedDraftId}`,
  });
  revalidatePath("/");
  revalidatePath("/money");
}

export async function updateOccurrenceAction(
  previous: import("@/lib/forms/action-state").FormActionState,
  formData: FormData,
): Promise<import("@/lib/forms/action-state").FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const input = parseOccurrenceAction(formData);
    if (input.intent === "complete") {
      await validateCompletionPhoto(input.photoPath);
      await completeOccurrence({
        occurrenceId: input.occurrenceId,
        idempotencyKey: input.idempotencyKey,
        completedOn: zurichCivilDate(),
        note: input.note || null,
        photoPath: input.photoPath || null,
      });
    } else if (input.intent === "skip") {
      await skipOccurrence({
        occurrenceId: input.occurrenceId,
        idempotencyKey: input.idempotencyKey,
      });
    } else {
      await validateRescheduleDate(input.occurrenceId, input.newDueDate);
      if (!input.newDueDate) return;
      await rescheduleOccurrence({
        occurrenceId: input.occurrenceId,
        idempotencyKey: input.idempotencyKey,
        newDueDate: input.newDueDate,
      });
    }
  });
  if (rejected) {
    const key = formData.get("idempotencyKey");
    return typeof key === "string" && uuidPattern.test(key)
      ? { ...rejected, values: { ...rejected.values, idempotencyKey: key } }
      : rejected;
  }
  revalidatePath("/");
  revalidatePath("/home");
  redirect(
    `/home/occurrences/${parseOccurrenceAction(formData).occurrenceId}?saved=1`,
  );
}
