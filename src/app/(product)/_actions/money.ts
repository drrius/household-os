"use server";

import { revalidatePath } from "next/cache";

import { confirmExpenseDraft } from "@/lib/money/commands";

export async function confirmDraftAction(formData: FormData): Promise<void> {
  const draftId = formData.get("draftId");
  if (typeof draftId !== "string" || draftId.length === 0) {
    throw new Error("A draft id is required");
  }

  await confirmExpenseDraft({
    draftId,
    idempotencyKey: `confirm-expense-draft:${draftId}`,
  });
  revalidatePath("/money");
  revalidatePath("/");
}
