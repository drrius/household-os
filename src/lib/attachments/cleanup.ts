import "server-only";

import { ATTACHMENT_BUCKET } from "@/domain/attachments/files";
import type { createClient } from "@/lib/supabase/server";

/** Claiming and marking for deletion serialize in Postgres; Storage deletes only
 * marked files. Failed removals stay marked and are retried on the next upload. */
export async function cleanupAttachments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  path: string | null = null,
): Promise<boolean> {
  const { data, error } = await supabase.rpc(
    "begin_household_attachment_cleanup",
    { p_path: path },
  );
  if (error) return false;
  let complete = true;
  for (const entry of (data ?? []) as { path: string }[]) {
    const removed = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .remove([entry.path]);
    if (removed.error) {
      complete = false;
      continue;
    }
    const finished = await supabase.rpc("finish_household_attachment_cleanup", {
      p_path: entry.path,
    });
    if (finished.error) complete = false;
  }
  return complete;
}
