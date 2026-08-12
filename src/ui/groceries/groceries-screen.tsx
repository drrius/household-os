import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { AppPage } from "@/ui/primitives/app-page";
import { PageHeader } from "@/ui/primitives/page-header";

import { DuplicateSuggestionList } from "./duplicate-suggestion-list.client";
import { GroceryList } from "./grocery-list";
import styles from "./groceries.module.css";
import { ShoppingSessionRail } from "./shopping-session-rail";

type GroceriesScreenProps = {
  claimAction: (formData: FormData) => Promise<void>;
  joinAction: () => Promise<void>;
  mergeAction: (formData: FormData) => Promise<void>;
  model: GroceriesViewModel;
};

function activeItemLabel(itemCount: number): string {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"} to buy`;
}

export function GroceriesScreen({
  claimAction,
  joinAction,
  mergeAction,
  model,
}: GroceriesScreenProps) {
  return (
    <AppPage labelledBy="groceries-title">
      <PageHeader
        eyebrow={activeItemLabel(model.activeItemCount)}
        title="Groceries"
        titleId="groceries-title"
      />
      {model.liveSession === null ? null : (
        <ShoppingSessionRail
          joinAction={joinAction}
          session={model.liveSession}
        />
      )}
      <DuplicateSuggestionList
        duplicates={model.duplicates}
        mergeAction={mergeAction}
      />
      <GroceryList categories={model.categories} claimAction={claimAction} />
      <details className={`card ${styles.history}`}>
        <summary>Purchased history</summary>
        <p>
          {model.recentHistoryLabel ??
            "No groceries were purchased in the last 30 days."}
        </p>
      </details>
    </AppPage>
  );
}
