import { requireMemberContext } from "@/lib/auth/member-context";
import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default async function PlanPage() {
  await requireMemberContext();

  return (
    <AppPage labelledBy="plan-title">
      <PageHeader titleId="plan-title" title="Plan" />
      <EmptyState title="Monday-to-Sunday meal board">
        <p>The week board and meal library will land here next.</p>
      </EmptyState>
    </AppPage>
  );
}
