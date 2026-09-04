import "server-only";

import { ATTACHMENT_BUCKET } from "@/domain/attachments/files";
import type { createClient } from "@/lib/supabase/server";
import { cleanupAttachments } from "./cleanup";

export async function uploadAttachment(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string,
  bytes: Uint8Array,
  mime: string,
): Promise<
  { status: number; path: string } | { status: number; error: string }
> {
  // Cleanup failures remain retryable and do not block a new upload.
  await cleanupAttachments(supabase).catch(() => false);
  const args = { p_path: path, p_content_type: mime };
  const reservation = await supabase.rpc("reserve_household_attachment", args);
  if (reservation.error)
    return {
      status: 409,
      error: "This upload expired. Choose the file again.",
    };
  if (reservation.data === true) return { status: 201, path };
  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: mime, upsert: false });
  if (error) {
    // A concurrent retry may have finished the same immutable upload.
    const recovered = await supabase.rpc("reserve_household_attachment", args);
    if (recovered.error || recovered.data !== true)
      return {
        status: 502,
        error: "Couldn't upload the file. Please try again.",
      };
  }
  return { status: 201, path };
}
