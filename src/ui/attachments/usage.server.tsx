import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAttachmentUsage } from "@/lib/attachments/usage";
import { AttachmentUsageDisplay } from "./usage";
export async function AttachmentUsageContent({
  client,
}: {
  client: SupabaseClient;
}) {
  return <AttachmentUsageDisplay usage={await loadAttachmentUsage(client)} />;
}
