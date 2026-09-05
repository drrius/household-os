import "server-only";
import {
  ATTACHMENT_BUCKET,
  isHouseholdAttachment,
} from "@/domain/attachments/files";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { loadAttachmentUsage } from "@/lib/attachments/usage";
import { cleanupAttachments } from "@/lib/attachments/cleanup";
import { attachmentSchemas } from "./definitions/attachment-tools";
import type { AiWriteHandler } from "./execute/types";
async function attachmentPath(input: unknown) {
  const { path } = attachmentSchemas.get_attachment_link.parse(input);
  const { householdId } = await requireMemberContext();
  if (!isHouseholdAttachment(path, householdId))
    throw new Error("This attachment is unavailable.");
  return path;
}
export async function readAttachmentTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_attachment_usage") {
    await requireMemberContext();
    return { usage: await loadAttachmentUsage(await createClient()) };
  }
  const path = await attachmentPath(input);
  const { data, error } = await (
    await createClient()
  ).storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60, { download: true });
  if (error || !data) throw new Error("This attachment is unavailable.");
  return {
    href: `/api/attachments?${new URLSearchParams({ path })}`,
    contentsRead: false,
  };
}
export const ATTACHMENT_HANDLERS: Record<string, AiWriteHandler> = {
  clean_unused_attachment: async (input) => {
    const path = await attachmentPath(input);
    if (!(await cleanupAttachments(await createClient(), path)))
      throw new Error("Could not finish upload cleanup. Retry later.");
    return { cleanupCompleted: true, savedFilesPreserved: true };
  },
};
