import "server-only";
import {
  INBOX_PAGE_SIZE,
  parseInboxContext,
  encodeInboxCursor,
  inboxBeforeFilter,
  type InboxContext,
  type InboxCursor,
} from "@/domain/notifications/inbox";
import {
  inboxRowSchema,
  presentInboxRow,
} from "@/domain/notifications/inbox-presentation";
import { availableInboxTargets } from "@/lib/notifications/inbox-targets";
import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { formatZurichTimestamp } from "@/lib/ui/zurich-date";

const digestRowSchema = z.object({
  enabled: z.boolean(),
  local_time: z.string(),
});

export type DigestPreferenceView = {
  enabled: boolean;
  localTime: string;
};

export type InboxItemView = {
  id: string;
  title: string;
  body: string;
  href: string;
  kindLabel: string;
  createdLabel: string;
  read: boolean;
};

export type InboxFeed = {
  items: InboxItemView[];
  unreadCount: number;
  unreadIds: string[];
};

export type InboxPageFeed = InboxFeed &
  InboxContext & { totalCount: number; nextCursor: InboxCursor | null };

function normalizeLocalTime(value: string): string {
  const match = /^(\d{2}):(\d{2})(?::\d{2})?$/u.exec(value.trim());
  if (!match) {
    return "08:00";
  }
  return `${match[1]}:${match[2]}`;
}

export async function loadDigestPreference(): Promise<DigestPreferenceView> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notification_digest_preferences")
    .select("enabled, local_time")
    .eq("member_id", member.userId)
    .maybeSingle();
  if (error) {
    throw new Error(`Digest preference load failed: ${error.message}`);
  }
  if (!data) {
    return { enabled: false, localTime: "08:00" };
  }
  const parsed = digestRowSchema.parse(data);
  return {
    enabled: parsed.enabled,
    localTime: normalizeLocalTime(String(parsed.local_time)),
  };
}

export async function loadInboxFeed(limit = 40): Promise<InboxFeed> {
  return loadInboxPage({ filter: "all", cursor: null }, limit);
}
export async function loadInboxPage(
  context: InboxContext,
  limit = INBOX_PAGE_SIZE,
): Promise<InboxPageFeed> {
  const parsedLimit = z.number().int().min(1).max(INBOX_PAGE_SIZE).parse(limit);
  const checked = parseInboxContext({
    filter: context.filter,
    cursor: context.cursor ? encodeInboxCursor(context.cursor) : null,
  });
  const member = await requireMemberContext();
  const supabase = await createClient();
  let query = supabase
    .from("inbox_notifications")
    .select(
      "id,kind,activity_kind,entity_type,entity_id,payload,read_at,created_at",
    )
    .eq("household_id", member.householdId)
    .eq("recipient_member_id", member.userId);
  if (checked.filter === "unread") query = query.is("read_at", null);
  if (checked.cursor) query = query.or(inboxBeforeFilter(checked.cursor));
  const countQuery = () =>
    supabase
      .from("inbox_notifications")
      .select("id", { count: "exact", head: true })
      .eq("household_id", member.householdId)
      .eq("recipient_member_id", member.userId);
  const [result, unread, total] = await Promise.all([
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .limit(parsedLimit + 1),
    countQuery().is("read_at", null),
    countQuery(),
  ]);
  if (result.error || unread.error || total.error)
    throw new Error("Couldn't load your inbox. Please try again.");
  const rows = z.array(inboxRowSchema).parse(result.data ?? []);
  const visible = rows.slice(0, parsedLimit);
  const available = await availableInboxTargets(
    visible,
    member.householdId,
    supabase,
  );
  const items = visible.map((row) => ({
    ...presentInboxRow(
      row,
      available.has(`${row.entity_type}:${row.entity_id}`),
    ),
    createdLabel: formatZurichTimestamp(row.created_at),
  }));
  const last = visible.at(-1);
  return {
    items,
    unreadCount: unread.count ?? 0,
    totalCount: total.count ?? 0,
    unreadIds: items.filter((item) => !item.read).map((item) => item.id),
    ...checked,
    nextCursor:
      rows.length > parsedLimit && last
        ? { createdAt: last.created_at, id: last.id }
        : null,
  };
}
