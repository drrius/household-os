import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  loadDigestPreference,
  loadInboxFeed,
} from "@/lib/read-models/notifications";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { DigestPreferenceForm } from "@/ui/notifications/digest-preference-form";
import { PushEnrollmentPanel } from "@/ui/notifications/push-enrollment-panel.client";
import { InstallGuidance } from "@/ui/pwa/install-guidance.client";
import { SavedNotice } from "@/ui/home/saved-notice.client";

const savedMessages = {
  digest: "Digest preference saved.",
} as const;

export default async function NotificationsSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const [preference, feed, query] = await Promise.all([
    loadDigestPreference(),
    loadInboxFeed(5),
    searchParams,
  ]);
  const saved =
    query.saved && query.saved in savedMessages
      ? savedMessages[query.saved as keyof typeof savedMessages]
      : null;

  return (
    <AppPage labelledBy="notifications-settings-title">
      <PageHeader
        title="Notifications & digest"
        titleId="notifications-settings-title"
        trailing={
          <Link
            className={cn(
              buttonVariants({ variant: "outline" }),
              "no-underline",
            )}
            href="/home"
          >
            Back
          </Link>
        }
      />
      <p className="text-sm text-muted-foreground">
        In-app inbox always works. Push is optional and stays off until you
        enable it on a device.
      </p>
      <SavedNotice message={saved} />
      <InstallGuidance />
      <Card>
        <CardContent className="grid gap-4">
          <div className="grid gap-1">
            <h2 className="font-heading text-lg font-bold">Inbox</h2>
            <p className="text-sm text-muted-foreground">
              {feed.unreadCount === 0
                ? "You are caught up."
                : `${feed.unreadCount} unread in your inbox.`}
            </p>
          </div>
          <Link
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "w-fit no-underline",
            )}
            href="/home/inbox"
          >
            Open inbox
          </Link>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="grid gap-3">
          <h2 className="font-heading text-lg font-bold">
            Push on this device
          </h2>
          <PushEnrollmentPanel />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <DigestPreferenceForm preference={preference} />
        </CardContent>
      </Card>
    </AppPage>
  );
}
