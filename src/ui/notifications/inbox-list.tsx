import Link from "next/link";

import { markInboxReadFormAction } from "@/app/(product)/_actions/notifications";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { InboxFeed, InboxItemView } from "@/lib/read-models/notifications";
import { cn } from "@/lib/utils";

function MarkReadButton({
  notificationIds,
  label,
}: {
  notificationIds: readonly string[];
  label: string;
}) {
  return (
    <form action={markInboxReadFormAction}>
      {notificationIds.map((id) => (
        <input key={id} name="notificationId" type="hidden" value={id} />
      ))}
      <button
        className={cn(buttonVariants({ size: "sm", variant: "outline" }))}
        type="submit"
      >
        {label}
      </button>
    </form>
  );
}

function InboxItemRow({ item }: { item: InboxItemView }) {
  return (
    <li className="grid gap-2 border-t py-3 first:border-t-0">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={item.read ? "outline" : "default"}>
          {item.kindLabel}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {item.createdLabel}
        </span>
        {!item.read ? (
          <span className="text-xs font-medium text-primary">Unread</span>
        ) : null}
      </div>
      <Link className="no-underline" href={item.href}>
        <strong className="font-heading">{item.title}</strong>
        <p className="text-sm text-muted-foreground">{item.body}</p>
      </Link>
      <div className="flex flex-wrap gap-2">
        <Link
          className={cn(
            buttonVariants({ size: "sm", variant: "ghost" }),
            "no-underline",
          )}
          href={item.href}
        >
          Open
        </Link>
        {!item.read ? (
          <MarkReadButton label="Mark read" notificationIds={[item.id]} />
        ) : null}
      </div>
    </li>
  );
}

export function InboxList({ feed }: { feed: InboxFeed }) {
  if (feed.items.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No notifications yet. Partner updates, reminders, and digests will
            land here even if push is off.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      {feed.unreadIds.length > 0 ? (
        <MarkReadButton
          label="Mark all read"
          notificationIds={feed.unreadIds}
        />
      ) : null}
      <Card>
        <CardContent>
          <ul className="list-none" aria-label="Inbox notifications">
            {feed.items.map((item) => (
              <InboxItemRow item={item} key={item.id} />
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
