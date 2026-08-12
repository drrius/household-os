import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default function GroceriesPage() {
  return (
    <AppPage labelledBy="groceries-title">
      <PageHeader
        titleId="groceries-title"
        title="Groceries"
        eyebrow="Shared list"
      />
      <EmptyState title="Categorized shopping list">
        <p>Categories, live sessions, and merge suggestions land here next.</p>
      </EmptyState>
    </AppPage>
  );
}
