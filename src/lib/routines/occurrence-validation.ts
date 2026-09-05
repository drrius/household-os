import "server-only";
import {
  ATTACHMENT_BUCKET,
  isHouseholdAttachment,
} from "@/domain/attachments/files";
import { requireMemberContext } from "@/lib/auth/member-context";
import { FormFieldError } from "@/lib/forms/field-error";
import { createClient } from "@/lib/supabase/server";

export async function validateCompletionPhoto(path: string | undefined) {
  if (!path) return;
  const member = await requireMemberContext();
  if (
    !isHouseholdAttachment(path, member.householdId) ||
    !/\/completions\/[^/]+\.(jpg|png|webp)$/i.test(path)
  )
    throw new FormFieldError(
      "photoPath",
      "Choose a completion photo uploaded to this household.",
    );
  const { data, error } = await (
    await createClient()
  ).storage
    .from(ATTACHMENT_BUCKET)
    .info(path);
  if (
    error ||
    !data ||
    !["image/jpeg", "image/png", "image/webp"].includes(
      String(data.contentType ?? data.metadata?.mimetype),
    )
  )
    throw new FormFieldError(
      "photoPath",
      "This photo is unavailable. Upload it again.",
    );
}
export async function validateRescheduleDate(
  id: string,
  newDate: string | undefined,
) {
  if (!newDate) throw new FormFieldError("newDueDate", "Choose a new date.");
  const member = await requireMemberContext();
  const { data, error } = await (
    await createClient()
  )
    .from("routine_occurrences")
    .select("due_date")
    .eq("household_id", member.householdId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    throw new Error("This occurrence is unavailable. Refresh and try again.");
  if (data.due_date === newDate)
    throw new FormFieldError(
      "newDueDate",
      "Choose a different date from the current due date.",
    );
}
