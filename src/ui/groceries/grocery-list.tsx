import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/ui/layout/empty-state";
import { CartControl } from "./cart-control.client";
import { PageSection } from "@/ui/layout/page-section";

type GroceryListProps = {
  categories: GroceriesViewModel["categories"];
  claimAction: (formData: FormData) => Promise<void>;
};

function GroceryItem({
  claimAction,
  item,
}: {
  claimAction: GroceryListProps["claimAction"];
  item: GroceriesViewModel["categories"][number]["items"][number];
}) {
  const isClaimed = item.claimedByName !== null;

  return (
    <li
      className={cn(
        "grid min-h-17 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-b py-3 pr-4 pl-2 last:border-b-0",
        isClaimed && "bg-success-soft",
      )}
    >
      <CartControl action={claimAction} item={item} />
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex min-h-11 items-center wrap-anywhere font-semibold underline-offset-4 hover:underline"
            href={`/groceries/items/${item.id}`}
          >
            {item.name}
          </Link>
          {item.quantity !== null || item.unit !== null ? (
            <span className="text-sm text-muted-foreground">
              {[item.quantity, item.unit].filter(Boolean).join(" ")}
            </span>
          ) : null}
          {item.duplicateHint !== null ? (
            <Badge variant="warning">{item.duplicateHint}</Badge>
          ) : null}
        </div>
        {item.note !== null ? (
          <p className="wrap-anywhere text-sm text-muted-foreground">
            {item.note}
          </p>
        ) : null}
        {item.claimedByName !== null ? (
          <p className="font-heading text-sm font-bold text-success">
            In {item.claimedByName}&apos;s cart
          </p>
        ) : null}
      </div>
    </li>
  );
}

export function GroceryList({ categories, claimAction }: GroceryListProps) {
  return (
    <PageSection title="Shopping list" titleId="grocery-list-title">
      {categories.length === 0 ? (
        <EmptyState
          action={
            <Link
              className={buttonVariants({ className: "no-underline" })}
              href="/groceries/new"
            >
              Add grocery
            </Link>
          }
          title="The list is empty"
        >
          <p>Add a grocery item or plan a meal to get started.</p>
        </EmptyState>
      ) : (
        <div className="grid gap-4">
          {categories.map((category) => {
            const categoryTitleId = `grocery-category-${category.id}`;
            return (
              <section
                aria-labelledby={categoryTitleId}
                className="grid gap-2"
                key={category.id}
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-xl" id={categoryTitleId}>
                    {category.name}
                  </h3>
                  <Badge className="text-muted-foreground" variant="outline">
                    {category.items.length}
                  </Badge>
                </div>
                <Card className="gap-0 py-0">
                  <CardContent className="px-0">
                    <ul className="list-none" role="list">
                      {category.items.map((item) => (
                        <GroceryItem
                          claimAction={claimAction}
                          item={item}
                          key={item.id}
                        />
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </section>
            );
          })}
        </div>
      )}
    </PageSection>
  );
}
