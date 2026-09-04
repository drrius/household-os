import { notFound } from "next/navigation";
import { ShoppingHistoryScreen } from "@/ui/groceries/shopping-history";
import { CheckoutCart } from "@/ui/groceries/checkout-cart";
import { CancelShoppingControl } from "@/ui/groceries/cancel-shopping-control.client";
import { groupGroceries } from "@/domain/groceries/order";
import type { ShoppingHistory } from "@/lib/groceries/shopping-history";

async function rejectCompletedCancellation() {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return "completed" as const;
}
const history: ShoppingHistory = {
  session: {
    id: "20000000-0000-4000-8000-000000000071",
    member_id: "00000000-0000-4000-8000-000000000071",
    finished_at: "2026-08-01T10:00:00Z",
    cancelled_at: null,
    receipt_total_cents: 12345,
    receipt_path:
      "10000000-0000-4000-8000-000000000071/receipts/40000000-0000-4000-8000-000000000071.pdf",
    draft_expense_id: "draft",
  },
  draft: {
    id: "draft",
    description: "Weekend shopping",
    amount_cents: 10000,
    status: "pending",
  },
  items: [],
  shopperName: "Alex",
};
const categories = [
  { id: "produce", name: "Produce", sort_order: 1 },
  { id: "bakery", name: "Bakery", sort_order: 2 },
];
const cart = [
  {
    id: "bread",
    name: "Bread",
    category_id: "bakery",
    sort_order: 0,
    quantity: "1",
    unit: null,
  },
  {
    id: "pears",
    name: "Pears",
    category_id: "produce",
    sort_order: 8,
    quantity: "2",
    unit: null,
  },
  {
    id: "apples",
    name: "Apples",
    category_id: "produce",
    sort_order: 1,
    quantity: "3",
    unit: null,
  },
];
export default async function GroceryReviewFixture({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { screen } = await params;
  if (screen === "retained") return <ShoppingHistoryScreen history={history} />;
  if (screen === "cancelled")
    return (
      <ShoppingHistoryScreen
        history={{
          ...history,
          session: {
            ...history.session,
            cancelled_at: history.session.finished_at,
            receipt_total_cents: null,
            receipt_path: null,
            draft_expense_id: null,
          },
          draft: null,
        }}
      />
    );
  if (screen === "ordering")
    return (
      <main className="mx-auto max-w-xl p-4">
        <CheckoutCart
          items={groupGroceries(categories, cart).flatMap(
            (group) => group.items,
          )}
        />
      </main>
    );
  if (screen === "late-cancel")
    return (
      <main className="mx-auto max-w-xl p-4">
        <CancelShoppingControl
          sessionId={history.session.id}
          action={rejectCompletedCancellation}
        />
      </main>
    );
  notFound();
}
