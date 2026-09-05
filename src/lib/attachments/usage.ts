import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  attachmentUsage,
  type AttachmentUsage,
} from "@/domain/attachments/usage";
export async function loadAttachmentUsage(
  client: Pick<SupabaseClient, "rpc">,
): Promise<AttachmentUsage> {
  try {
    const { data, error } = await client.rpc("household_attachment_usage");
    return error ? { status: "unavailable" } : attachmentUsage(data);
  } catch {
    return { status: "unavailable" };
  }
}
