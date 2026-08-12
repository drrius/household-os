import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";

export default function NewRoutinePage() {
  return (
    <AppPage labelledBy="new-routine-title">
      <PageHeader titleId="new-routine-title" title="New routine" />
      <EmptyState title="Routine form coming soon">
        <p>Create one-off or recurring routines from this screen.</p>
      </EmptyState>
    </AppPage>
  );
}
