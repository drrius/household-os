import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";

export default function NewExpensePage() {
  return (
    <AppPage labelledBy="new-expense-title">
      <PageHeader titleId="new-expense-title" title="New expense" />
      <EmptyState title="Expense form coming soon">
        <p>Post a CHF expense with 50/50 or exact split from here.</p>
      </EmptyState>
    </AppPage>
  );
}
