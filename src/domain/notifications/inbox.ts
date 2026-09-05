import { z } from "zod";
export const INBOX_PAGE_SIZE = 40;
const timestamp = z.iso.datetime({ offset: true }).max(40);
const cursorSchema = z.object({ createdAt: timestamp, id: z.uuid() });
export type InboxCursor = z.infer<typeof cursorSchema>;
export type InboxFilter = "all" | "unread";
export type InboxContext = { filter: InboxFilter; cursor: InboxCursor | null };
export function parseInboxContext(input: {
  filter?: unknown;
  cursor?: unknown;
}): InboxContext {
  const filter = z.enum(["all", "unread"]).parse(input.filter ?? "all");
  if (
    input.cursor === undefined ||
    input.cursor === null ||
    input.cursor === ""
  )
    return { filter, cursor: null };
  const raw = z.string().max(80).parse(input.cursor);
  const parts = raw.split("~");
  if (parts.length !== 2) throw new Error("This inbox position is invalid.");
  return {
    filter,
    cursor: cursorSchema.parse({ createdAt: parts[0], id: parts[1] }),
  };
}
export function encodeInboxCursor(cursor: InboxCursor): string {
  const checked = cursorSchema.parse(cursor);
  return `${checked.createdAt}~${checked.id}`;
}
export function inboxHref(context: InboxContext): string {
  return `/home/inbox?filter=${context.filter}${context.cursor ? `&cursor=${encodeURIComponent(encodeInboxCursor(context.cursor))}` : ""}`;
}
export function inboxBeforeFilter(cursor: InboxCursor): string {
  const checked = cursorSchema.parse(cursor);
  return `created_at.lt.${checked.createdAt},and(created_at.eq.${checked.createdAt},id.lt.${checked.id})`;
}
export function inboxReadIds(input: unknown): string[] {
  return [
    ...new Set(z.array(z.uuid()).min(1).max(INBOX_PAGE_SIZE).parse(input)),
  ];
}
