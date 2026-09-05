import { parseInboxContext } from "@/domain/notifications/inbox";
import { loadInboxPage } from "@/lib/read-models/notifications";
import {
  InboxScreen,
  InvalidInboxPosition,
} from "@/ui/notifications/inbox-screen";
export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; cursor?: string; saved?: string }>;
}) {
  const query = await searchParams;
  let context;
  try {
    context = parseInboxContext(query);
  } catch {
    return <InvalidInboxPosition />;
  }
  return (
    <InboxScreen
      feed={await loadInboxPage(context)}
      saved={query.saved === "read"}
    />
  );
}
