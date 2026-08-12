import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

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
