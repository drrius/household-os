import { AppPage } from "@/ui/primitives/app-page";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";

export default function NewMealPage() {
  return (
    <AppPage labelledBy="new-meal-title">
      <PageHeader titleId="new-meal-title" title="New meal" />
      <EmptyState title="Meal form coming soon">
        <p>Place a meal onto a day on the week board from here.</p>
      </EmptyState>
    </AppPage>
  );
}
