import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadInboxFeed } from "@/lib/read-models/notifications";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { InboxList } from "@/ui/notifications/inbox-list";

export default async function InboxPage() {
  const feed = await loadInboxFeed();

  return (
    <AppPage labelledBy="inbox-title">
      <PageHeader
        title="Inbox"
        titleId="inbox-title"
        trailing={
          <Link
            className={cn(
              buttonVariants({ variant: "outline" }),
              "no-underline",
            )}
            href="/home/notifications"
          >
            Settings
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">
        Partner notices, routine reminders, and digests. Push is optional.
      </p>
      <InboxList feed={feed} />
    </AppPage>
  );
}
