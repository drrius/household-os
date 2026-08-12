import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";

export default function ProductLoading() {
  return (
    <AppPage labelledBy="loading-title">
      <PageHeader title="Loading" titleId="loading-title" />
      <EmptyState title="Fetching the household view">
        <p>One moment while we load the latest shared state.</p>
      </EmptyState>
    </AppPage>
  );
}
