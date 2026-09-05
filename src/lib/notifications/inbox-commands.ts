import "server-only";
import { z } from "zod";
import { inboxReadIds } from "@/domain/notifications/inbox";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
export async function markInboxPageRead(input: unknown) {
  const member = await requireMemberContext();
  const ids = inboxReadIds(input);
  const db = await createClient();
  const { data, error } = await db
    .from("inbox_notifications")
    .select("id")
    .eq("household_id", member.householdId)
    .eq("recipient_member_id", member.userId)
    .in("id", ids)
    .limit(ids.length);
  if (error || !data || data.length !== ids.length)
    throw new Error(
      "This inbox page changed. Reload it before marking messages read.",
    );
  const result = await db.rpc("mark_inbox_notifications_read", {
    p_notification_ids: ids,
  });
  if (result.error)
    throw new Error("Couldn't mark these messages read. Please try again.");
  const marked = z
    .object({ marked: z.number().int().nonnegative() })
    .parse(result.data).marked;
  if (marked !== ids.length)
    throw new Error(
      "This inbox page changed. Reload to see which messages are still unread.",
    );
}
