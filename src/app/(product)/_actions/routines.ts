"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";

import { confirmExpenseDraft } from "@/lib/money/commands";
import { completeOccurrence } from "@/lib/routines/commands";
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
  await completeOccurrence({
    occurrenceId: requireUuid(occurrenceId, "Occurrence ID"),
    idempotencyKey: randomUUID(),
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
