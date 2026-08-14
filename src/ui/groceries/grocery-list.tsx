import { CheckIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/ui/layout/empty-state";
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
  const canToggle = !isClaimed || item.claimedByMe;

  return (
    <li
      className={cn(
        "grid min-h-17 grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-3 border-b py-3 pr-4 pl-2 last:border-b-0",
        isClaimed && "bg-success-soft",
      )}
    >
      <form action={claimAction} className="flex">
        <input name="itemId" type="hidden" value={item.id} />
        <input
          name="intent"
          type="hidden"
          value={item.claimedByMe ? "release" : "claim"}
        />
        <Button
          aria-checked={isClaimed}
          aria-label={
            item.claimedByMe
              ? `Remove ${item.name} from your cart`
              : isClaimed
                ? `${item.name} is in ${item.claimedByName}'s cart`
                : `Add ${item.name} to your cart`
          }
          className="size-11"
          disabled={!canToggle}
          role="checkbox"
          size="icon-lg"
          type="submit"
          variant="ghost"
        >
          <span
            aria-hidden="true"
            className={cn(
              "inline-flex size-6 items-center justify-center rounded-[6px] border border-input",
              isClaimed && "border-success bg-success text-success-foreground",
            )}
          >
            {isClaimed ? (
              <CheckIcon className="size-4 shrink-0" strokeWidth={3} />
            ) : null}
          </span>
        </Button>
      </form>
      <div className="grid min-w-0 gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="wrap-anywhere">{item.name}</strong>
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
                    <ul className="list-none">
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
