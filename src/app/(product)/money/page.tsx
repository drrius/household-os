import { requireMemberContext } from "@/lib/auth/member-context";
import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default async function MoneyPage() {
  await requireMemberContext();

  return (
    <AppPage labelledBy="money-title">
      <PageHeader titleId="money-title" title="Money" eyebrow="Right now" />
      <EmptyState title="One net CHF balance">
        <p>
          Balance, drafts, settlements, and the event ledger land here next.
        </p>
      </EmptyState>
    </AppPage>
  );
}
