import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { inboxHref, type InboxContext } from "@/domain/notifications/inbox";
import type { InboxPageFeed } from "@/lib/read-models/notifications";
import type { FormAction } from "@/lib/forms/action-state";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { InboxList } from "./inbox-list";
export function InboxScreen({
  feed,
  saved = false,
  action,
  hrefForContext = inboxHref,
}: {
  feed: InboxPageFeed;
  saved?: boolean;
  action?: FormAction;
  hrefForContext?: (context: InboxContext) => string;
}) {
  return (
    <AppPage labelledBy="inbox-title">
      <PageHeader
        title="Inbox"
        titleId="inbox-title"
        eyebrow={feed.unreadCount ? `${feed.unreadCount} unread` : "Up to date"}
        trailing={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/home/notifications"
          >
            Settings
          </Link>
        }
      />
      <div className="grid max-w-3xl gap-5">
        <nav aria-label="Inbox filter" className="flex flex-wrap gap-2">
          {(["all", "unread"] as const).map((filter) => (
            <Link
              key={filter}
              aria-current={feed.filter === filter ? "page" : undefined}
              className={buttonVariants({
                variant: feed.filter === filter ? "secondary" : "outline",
              })}
              href={hrefForContext({ filter, cursor: null })}
            >
              {filter === "all" ? "All" : "Unread"}
            </Link>
          ))}
        </nav>
        {saved ? (
          <p role="status" className="text-sm text-muted-foreground">
            Messages marked read.
          </p>
        ) : null}
        <InboxList feed={feed} action={action} />
        <nav
          aria-label="Inbox pages"
          className="flex flex-wrap items-center justify-between gap-3 border-t pt-4"
        >
          {feed.cursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={hrefForContext({ filter: feed.filter, cursor: null })}
            >
              Latest messages
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">
              Latest {feed.items.length}{" "}
              {feed.items.length === 1 ? "message" : "messages"}
            </span>
          )}
          {feed.nextCursor ? (
            <Link
              className={buttonVariants({ variant: "outline" })}
              href={hrefForContext({
                filter: feed.filter,
                cursor: feed.nextCursor,
              })}
            >
              Older messages
            </Link>
          ) : null}
        </nav>
      </div>
    </AppPage>
  );
}
export function InvalidInboxPosition() {
  return (
    <AppPage labelledBy="inbox-title">
      <PageHeader title="Inbox" titleId="inbox-title" />
      <p>This saved inbox position is no longer valid.</p>
      <Link href="/home/inbox">Open the latest messages</Link>
    </AppPage>
  );
}
