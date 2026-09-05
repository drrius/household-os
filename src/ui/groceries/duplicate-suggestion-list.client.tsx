"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { GroceryMutationButton } from "./mutation-button.client";

type Duplicate = GroceriesViewModel["duplicates"][number];
function keyFor(duplicate: Duplicate) {
  return `${duplicate.leftId}:${duplicate.rightId}`;
}

export function DuplicateSuggestionList({
  duplicates,
  categories = [],
  mergeAction,
}: {
  duplicates: Duplicate[];
  categories?: GroceriesViewModel["categories"];
  mergeAction: (data: FormData) => Promise<void>;
}) {
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const visible = duplicates.filter(
    (duplicate) => !dismissed.has(keyFor(duplicate)),
  );
  const items = new Map(
    categories.flatMap((category) =>
      category.items.map((item) => [item.id, item] as const),
    ),
  );
  if (visible.length === 0) return null;
  return (
    <details className="rounded-2xl border border-warning/30 bg-warning-soft px-4 py-2">
      <summary className="min-h-12 cursor-pointer content-center font-semibold">
        Possible duplicates · {visible.length}
      </summary>
      <ul className="grid gap-4" role="list">
        {visible.map((duplicate) => {
          const key = keyFor(duplicate);
          const dismiss = () =>
            setDismissed((current) => new Set([...current, key]));
          return (
            <li className="grid gap-3 border-t py-4" key={key}>
              <div className="grid gap-2">
                {[duplicate.leftId, duplicate.rightId].map((id, index) => {
                  const item = items.get(id);
                  return (
                    <DuplicateItemDetail
                      key={id}
                      id={id}
                      item={item}
                      fallbackName={
                        index === 0 ? duplicate.leftName : duplicate.rightName
                      }
                    />
                  );
                })}
              </div>
              <p className="text-sm text-muted-foreground">
                Merging keeps the first item&apos;s quantity, category, and
                note. Edit it first if you need a different amount.
              </p>
              <div className="flex flex-wrap items-start gap-2">
                <GroceryMutationButton
                  action={mergeAction}
                  fields={{
                    leftId: duplicate.leftId,
                    rightId: duplicate.rightId,
                  }}
                  label="Keep first and merge"
                  onSuccess={dismiss}
                  successMessage="Duplicates merged"
                />
                <Button
                  className="min-h-11"
                  onClick={dismiss}
                  type="button"
                  variant="ghost"
                >
                  Keep both
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

function DuplicateItemDetail({
  id,
  item,
  fallbackName,
}: {
  id: string;
  item: GroceriesViewModel["categories"][number]["items"][number] | undefined;
  fallbackName: string;
}) {
  return (
    <div className="grid gap-1">
      <p>
        <Link
          className="inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
          href={`/groceries/items/${id}`}
        >
          {item?.name ?? fallbackName}
        </Link>
        {item
          ? ` · ${[item.quantity, item.unit].filter(Boolean).join(" ") || "No quantity"}`
          : ""}
      </p>
      {item?.note ? (
        <p className="text-sm text-muted-foreground">{item.note}</p>
      ) : null}
    </div>
  );
}
