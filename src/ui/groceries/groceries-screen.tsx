import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

import { DuplicateSuggestionList } from "./duplicate-suggestion-list.client";
import { GroceryList } from "./grocery-list";
import { PurchasedHistory } from "./purchased-history.client";
import { QuickAdd } from "./quick-add.client";
import { ShoppingSessionRail } from "./shopping-session-rail";

type GroceriesScreenProps = {
  claimAction: (formData: FormData) => Promise<void>;
  finishAction?: () => Promise<void>;
  addAction?: (data: FormData) => Promise<void>;
  buyAgainAction?: (data: FormData) => Promise<void>;
  joinAction: () => Promise<void>;
  mergeAction: (formData: FormData) => Promise<void>;
  model: GroceriesViewModel;
};

function activeItemLabel(itemCount: number): string {
  return `${itemCount} ${itemCount === 1 ? "item" : "items"} to buy`;
}

export function GroceriesScreen({
  claimAction,
  addAction,
  buyAgainAction,
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
        trailing={
          <Link
            className={buttonVariants({
              className: "no-underline",
              variant: "outline",
            })}
            href="/groceries/categories"
          >
            Categories
          </Link>
        }
      />
      {addAction ? <QuickAdd action={addAction} /> : null}
      {model.liveSession === null ? null : (
        <ShoppingSessionRail
          joinAction={joinAction}
          session={model.liveSession}
        />
      )}
      <GroceryList categories={model.categories} claimAction={claimAction} />
      <DuplicateSuggestionList
        categories={model.categories}
        duplicates={model.duplicates}
        mergeAction={mergeAction}
      />
      <Card size="sm">
        <CardContent>
          <PurchasedHistory
            recentHistoryLabel={model.recentHistoryLabel}
            items={model.history}
            shops={model.recentShops}
            buyAgainAction={buyAgainAction}
          />
        </CardContent>
      </Card>
    </AppPage>
  );
}
