import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import {
  InboxScreen,
  InvalidInboxPosition,
} from "@/ui/notifications/inbox-screen";
import { AppShell } from "@/ui/shell/app-shell";
import { fixtureMarkRead } from "./actions";
import { fixtureInbox, fixtureInboxHref } from "./data";
export default async function InboxFixture({
  searchParams,
}: {
  searchParams: Promise<{
    filter?: string;
    cursor?: string;
    state?: string;
    saved?: string;
  }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const query = await searchParams;
  const readIds = ((await cookies()).get("inbox-read")?.value ?? "").split(",");
  let feed;
  try {
    feed = fixtureInbox(query, readIds);
  } catch {
    return (
      <AppShell>
        <InvalidInboxPosition />
      </AppShell>
    );
  }
  return (
    <AppShell>
      <InboxScreen
        feed={feed}
        saved={query.saved === "read"}
        action={fixtureMarkRead}
        hrefForContext={fixtureInboxHref}
      />
    </AppShell>
  );
}
