import {
  inboxHref,
  parseInboxContext,
  type InboxContext,
} from "@/domain/notifications/inbox";
import type {
  InboxPageFeed,
  InboxItemView,
} from "@/lib/read-models/notifications";
export const fixtureInboxHref = (context: InboxContext) =>
  inboxHref(context).replace("/home/inbox", "/m7-fixture/inbox");
const entries = Array.from({ length: 6 }, (_, index) => ({
  id: `11111111-1111-4111-8111-${String(6 - index).padStart(12, "0")}`,
  createdAt:
    index < 3 ? "2026-09-05T12:00:00.123456Z" : "2026-09-04T12:00:00.123456Z",
  title: [
    "Routine rescheduled",
    "Expense posted",
    "Shopping finished",
    "Routine updated",
    "Household digest",
    "Earlier reminder",
  ][index]!,
  body: "Open the related household record.",
  kindLabel: "Partner",
  createdLabel: "5 September · 14:00",
  read: false,
  href:
    index === 0
      ? "/home/routines/11111111-1111-4111-8111-111111111111/edit"
      : "/money",
}));
export function fixtureInbox(
  query: { filter?: string; cursor?: string; state?: string },
  readIds: readonly string[],
): InboxPageFeed {
  const context = parseInboxContext(query);
  const all = (query.state === "empty" ? [] : entries).map((row) => ({
    ...row,
    read: query.state === "caught-up" || readIds.includes(row.id),
  }));
  const filtered = all
    .filter((row) => context.filter !== "unread" || !row.read)
    .filter(
      (row) =>
        !context.cursor ||
        row.createdAt < context.cursor.createdAt ||
        (row.createdAt === context.cursor.createdAt &&
          row.id < context.cursor.id),
    );
  const items: InboxItemView[] = filtered.slice(0, 2);
  const last = filtered[1];
  return {
    ...context,
    items,
    totalCount: all.length,
    unreadCount: all.filter((row) => !row.read).length,
    unreadIds: items.filter((row) => !row.read).map((row) => row.id),
    nextCursor:
      filtered.length > 2 && last
        ? { id: last.id, createdAt: last.createdAt }
        : null,
  };
}
