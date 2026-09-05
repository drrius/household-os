"use client";

import { useState } from "react";
import type { GroceriesViewModel } from "@/lib/read-models/groceries";
import { GroceriesScreen } from "@/ui/groceries/groceries-screen";
import { CheckoutForm } from "@/ui/groceries/checkout-form.client";
import { parseShoppingForm } from "@/lib/forms/shopping";
import { formRejection } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";

const viewerId = "00000000-0000-4000-8000-000000000001";
const partnerId = "00000000-0000-4000-8000-000000000002";
const initial: GroceriesViewModel = {
  activeItemCount: 2,
  categories: [
    {
      id: "produce",
      name: "Produce",
      items: [
        {
          id: "apple",
          name: "Apples",
          quantity: "4",
          unit: null,
          note: null,
          claimedByName: null,
          claimedByMe: false,
          duplicateHint: null,
        },
        {
          id: "conflict",
          name: "Last avocado",
          quantity: "1",
          unit: null,
          note: null,
          claimedByName: null,
          claimedByMe: false,
          duplicateHint: null,
        },
      ],
    },
  ],
  liveSession: null,
  duplicates: [],
  recentHistoryLabel: "1 item purchased in the last 30 days",
  history: [
    {
      id: "milk",
      name: "Milk",
      quantity: "1",
      unit: "L",
      purchasedAt: "2026-09-04T12:00:00Z",
      mealId: null,
    },
  ],
};

export function GroceryFixture() {
  const [model, setModel] = useState(initial);
  const [result, setResult] = useState("");
  const [checkout, setCheckout] = useState(false);
  async function add(data: FormData) {
    const name = String(data.get("name"));
    if (name === "Fail") throw new Error("The connection dropped. Try again.");
    setModel((current) => ({
      ...current,
      activeItemCount: current.activeItemCount + 1,
      categories: current.categories.map((category) => ({
        ...category,
        items: [
          ...category.items,
          {
            id: crypto.randomUUID(),
            name,
            quantity: null,
            unit: null,
            note: null,
            claimedByName: null,
            claimedByMe: false,
            duplicateHint: null,
          },
        ],
      })),
    }));
  }
  return (
    <main className="mx-auto min-h-dvh max-w-3xl p-4">
      <button
        className="min-h-11 underline"
        onClick={() => setCheckout((current) => !current)}
        type="button"
      >
        {checkout ? "Show groceries" : "Show checkout"}
      </button>
      {checkout ? (
        <FixtureCheckout onResult={setResult} />
      ) : (
        <GroceriesScreen
          addAction={add}
          buyAgainAction={async () => {
            const data = new FormData();
            data.set("name", "Milk");
            await add(data);
          }}
          claimAction={async (data) => {
            const id = String(data.get("itemId"));
            const claim = data.get("intent") === "claim";
            setModel((current) => ({
              ...current,
              categories: current.categories.map((category) => ({
                ...category,
                items: category.items.map((item) =>
                  item.id === id
                    ? {
                        ...item,
                        claimedByName:
                          id === "conflict" ? "Leah" : claim ? "You" : null,
                        claimedByMe: id !== "conflict" && claim,
                      }
                    : item,
                ),
              })),
            }));
            if (id === "conflict")
              throw new Error("Leah already has this item in her cart.");
          }}
          joinAction={async () => {}}
          mergeAction={async () => {}}
          model={model}
        />
      )}
      <output aria-label="Saved checkout" className="sr-only">
        {result}
      </output>
    </main>
  );
}

function FixtureCheckout({ onResult }: { onResult: (result: string) => void }) {
  return (
    <CheckoutForm
      action={async (previous, data) => {
        try {
          const input = parseShoppingForm(data, [viewerId, partnerId]);
          onResult(JSON.stringify(input));
          return { submissionId: previous.submissionId + 1 };
        } catch (failure) {
          return formRejection(previous, failure, echoValues(data));
        }
      }}
      sessionId="10000000-0000-4000-8000-000000000001"
      members={[
        { user_id: viewerId, display_name: "Darius" },
        { user_id: partnerId, display_name: "Leah" },
      ]}
      viewerId={viewerId}
      occurredOn="2026-09-05"
      idempotencyKey="20000000-0000-4000-8000-000000000001"
    />
  );
}
