import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";

export default function NewGroceryPage() {
  return (
    <AppPage labelledBy="new-grocery-title">
      <PageHeader titleId="new-grocery-title" title="New grocery item" />
      <EmptyState title="Grocery form coming soon">
        <p>Add items straight onto the shared list from here.</p>
      </EmptyState>
    </AppPage>
  );
}
