import "server-only";

import { isHouseholdAttachment } from "@/domain/attachments/files";
import { FormFieldError } from "@/lib/forms/field-error";
import { createClient } from "@/lib/supabase/server";

export function validateReceiptPath(
  value: unknown,
  householdId: string,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !isHouseholdAttachment(value, householdId))
    throw new FormFieldError(
      "receiptPath",
      "Choose a receipt uploaded to this household.",
    );
  return value;
}

export async function shoppingDraftReceipt(
  draftId: string,
  householdId: string,
) {
  const client = await createClient();
  const { data: draft, error } = await client
    .from("expense_drafts")
    .select("shopping_session_id")
    .eq("household_id", householdId)
    .eq("id", draftId)
    .maybeSingle();
  if (error || !draft)
    throw new Error("This expense draft is no longer available.");
  if (!draft.shopping_session_id) return null;
  const { data: session, error: sessionError } = await client
    .from("shopping_sessions")
    .select("receipt_path")
    .eq("household_id", householdId)
    .eq("id", draft.shopping_session_id)
    .maybeSingle();
  if (sessionError || !session)
    throw new Error("Could not load the shopping receipt. Try again.");
  return validateReceiptPath(session.receipt_path, householdId);
}
