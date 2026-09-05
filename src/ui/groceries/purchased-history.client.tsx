"use client";

import Link from "next/link";
import { useState } from "react";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { GroceryMutationButton } from "./mutation-button.client";

function dateLabel(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CH", {
    day: "numeric",
    month: "short",
    timeZone: "Europe/Zurich",
  }).format(new Date(timestamp));
}

function HistoryItem({
  item,
  buyAgainAction,
}: {
  item: NonNullable<GroceriesViewModel["history"]>[number];
  buyAgainAction?: (data: FormData) => Promise<void>;
}) {
  const [added, setAdded] = useState(false);
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 border-b py-3 last:border-0">
      <div className="grid gap-1">
        <p className="font-medium">
          {item.name}{" "}
          <span className="font-normal text-muted-foreground">
            {[item.quantity, item.unit].filter(Boolean).join(" ")}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {dateLabel(item.purchasedAt)}
          {item.mealId ? (
            <>
              {" "}
              ·{" "}
              <Link
                className="underline underline-offset-4"
                href={`/plan/meals/${item.mealId}`}
              >
                Linked meal
              </Link>
            </>
          ) : null}
        </p>
      </div>
      {buyAgainAction ? (
        <GroceryMutationButton
          action={buyAgainAction}
          disabled={added}
          fields={{ itemId: item.id }}
          label={added ? "Added to list" : `Buy ${item.name} again`}
          onSuccess={() => setAdded(true)}
          successMessage="Added to your shopping list"
        />
      ) : null}
    </li>
  );
}

export function PurchasedHistory({
  recentHistoryLabel,
  items = [],
  shops = [],
  buyAgainAction,
}: {
  recentHistoryLabel: string | null;
  items?: GroceriesViewModel["history"];
  shops?: GroceriesViewModel["recentShops"];
  buyAgainAction?: (data: FormData) => Promise<void>;
}) {
  return (
    <details>
      <summary className="min-h-12 cursor-pointer content-center font-heading text-xl font-semibold">
        Purchased history
      </summary>
      <div className="grid gap-4">
        <p className="text-muted-foreground">
          {recentHistoryLabel ??
            "No groceries were purchased in the last 30 days."}
        </p>
        {shops.length ? (
          <div className="flex flex-wrap gap-2">
            {shops.map((shop) => (
              <Link
                className="grid min-h-12 gap-1 rounded-xl border px-3 py-2 hover:bg-muted"
                href={`/groceries/shopping/${shop.id}`}
                key={shop.id}
              >
                <p className="font-medium">
                  {dateLabel(shop.finishedAt)} · {shop.memberName}
                </p>
                <p className="text-sm text-muted-foreground">
                  {shop.receiptTotalCents === null
                    ? "View shop"
                    : `Receipt ${formatCentimesAsFrancs(shop.receiptTotalCents)}`}
                  {shop.draftId ? " · Shared expense" : ""}
                </p>
              </Link>
            ))}
          </div>
        ) : null}
        <ul className="list-none" role="list">
          {items.map((item) => (
            <HistoryItem
              buyAgainAction={buyAgainAction}
              item={item}
              key={item.id}
            />
          ))}
        </ul>
      </div>
    </details>
  );
}
