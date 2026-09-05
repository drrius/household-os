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
  const paths = ((data ?? []) as { path: string }[]).map((entry) => entry.path);
  if (paths.length === 0) return true;
  const removed = await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
  if (removed.error) return false;
  const results = await Promise.all(
    paths.map((entry) =>
      supabase.rpc("finish_household_attachment_cleanup", { p_path: entry }),
    ),
  );
  return results.every((result) => !result.error);
}
