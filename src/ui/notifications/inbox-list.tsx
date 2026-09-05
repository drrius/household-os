import Link from "next/link";
import { emptyInboxCopy } from "@/domain/notifications/inbox-presentation";
import { Badge } from "@/components/ui/badge";
import type {
  InboxPageFeed,
  InboxItemView,
} from "@/lib/read-models/notifications";
import type { InboxContext } from "@/domain/notifications/inbox";
import type { FormAction } from "@/lib/forms/action-state";
import { InboxReadControl } from "./inbox-read-control.client";
function InboxItemRow({
  item,
  context,
  action,
}: {
  item: InboxItemView;
  context: InboxContext;
  action?: FormAction;
}) {
  return (
    <li className="grid gap-3 border-t py-5 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{item.kindLabel}</Badge>
        <span className="text-sm text-muted-foreground">
          {item.createdLabel}
        </span>
        {!item.read ? (
          <span className="text-sm font-medium text-primary">Unread</span>
        ) : null}
      </div>
      <Link
        className="grid min-h-11 gap-1 no-underline hover:underline"
        href={item.href}
      >
        <h2 className="font-heading text-lg font-semibold">{item.title}</h2>
        <p className="text-base text-muted-foreground sm:text-sm">
          {item.body}
        </p>
      </Link>
      {!item.read ? (
        <InboxReadControl
          ids={[item.id]}
          label="Mark read"
          context={context}
          action={action}
        />
      ) : null}
    </li>
  );
}
export function InboxList({
  feed,
  action,
}: {
  feed: InboxPageFeed;
  action?: FormAction;
}) {
  const context: InboxContext = { filter: feed.filter, cursor: feed.cursor };
  if (!feed.items.length) {
    const copy = emptyInboxCopy({
      older: feed.cursor !== null,
      unreadOnly: feed.filter === "unread",
      totalCount: feed.totalCount,
      unreadCount: feed.unreadCount,
    });
    return (
      <div className="grid gap-2 rounded-xl border p-5">
        <h2 className="font-heading text-lg font-semibold">{copy.title}</h2>
        <p className="text-muted-foreground">{copy.body}</p>
      </div>
    );
  }
  return (
    <div className="grid gap-4">
      {feed.unreadIds.length ? (
        <InboxReadControl
          ids={feed.unreadIds}
          label="Mark this page read"
          context={context}
          action={action}
        />
      ) : null}
      <ul aria-label="Inbox notifications" className="grid list-none">
        {feed.items.map((item) => (
          <InboxItemRow
            item={item}
            key={item.id}
            context={context}
            action={action}
          />
        ))}
      </ul>
    </div>
  );
}
