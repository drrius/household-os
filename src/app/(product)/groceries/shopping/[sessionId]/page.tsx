import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";

import { buyGroceryAgainAction } from "@/lib/groceries/list-actions";
import { buttonVariants } from "@/components/ui/button";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { GroceryMutationButton } from "@/ui/groceries/mutation-button.client";

async function loadShoppingHistory({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { sessionId } = await params;
  if (!z.string().uuid().safeParse(sessionId).success) notFound();
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [sessionResult, links] = await Promise.all([
    supabase
      .from("shopping_sessions")
      .select(
        "id, member_id, finished_at, receipt_total_cents, receipt_path, draft_expense_id",
      )
      .eq("household_id", member.householdId)
      .eq("id", sessionId)
      .not("finished_at", "is", null)
      .maybeSingle(),
    supabase
      .from("shopping_session_items")
      .select("grocery_item_id")
      .eq("household_id", member.householdId)
      .eq("shopping_session_id", sessionId)
      .not("purchased_at", "is", null),
  ]);
  if (sessionResult.error || links.error)
    throw new Error("Couldn't load this shopping trip.");
  const session = sessionResult.data;
  if (!session || !session.finished_at) notFound();
  const [itemsResult, draftResult, shopperResult] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id, name, quantity, unit, note")
      .eq("household_id", member.householdId)
      .in(
        "id",
        links.data.map((item) => item.grocery_item_id),
      ),
    session.draft_expense_id
      ? supabase
          .from("expense_drafts")
          .select("id, description, amount_cents, status")
          .eq("household_id", member.householdId)
          .eq("id", session.draft_expense_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("household_members")
      .select("display_name")
      .eq("household_id", member.householdId)
      .eq("user_id", session.member_id)
      .single(),
  ]);
  if (itemsResult.error || draftResult.error || shopperResult.error)
    throw new Error("Couldn't load this shopping trip's details.");
  const draft = draftResult.data;
  return {
    session,
    draft,
    items: itemsResult.data,
    shopperName: shopperResult.data.display_name,
  };
}

export default async function ShoppingHistoryPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  const { session, draft, items, shopperName } = await loadShoppingHistory({
    params,
  });
  const date = new Intl.DateTimeFormat("en-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Zurich",
  }).format(new Date(session.finished_at));
  return (
    <AppPage labelledBy="shop-title">
      <PageHeader
        eyebrow={`${date} · ${shopperName}`}
        title={
          items.length > 0 ? "Shopping complete" : "Shopping session ended"
        }
        titleId="shop-title"
        trailing={
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/groceries"
          >
            Back to list
          </Link>
        }
      />
      <div className="grid max-w-2xl gap-6">
        <p>
          This session is closed. Items you still need are waiting on the list.
        </p>
        {session.receipt_total_cents !== null ? (
          <p className="text-lg">
            Receipt total{" "}
            <strong className="tabular-nums">
              {formatCentimesAsFrancs(session.receipt_total_cents)}
            </strong>
          </p>
        ) : null}
        {session.receipt_path ? (
          <a
            className="inline-flex min-h-11 items-center underline"
            href={`/api/attachments?path=${encodeURIComponent(session.receipt_path)}`}
            target="_blank"
            rel="noreferrer"
          >
            View receipt
          </a>
        ) : null}
        <ShoppingExpense draft={draft} />
        <ShoppingItems items={items} />
      </div>
    </AppPage>
  );
}

type Draft = {
  id: string;
  description: string;
  amount_cents: number | null;
  status: string;
};
function ShoppingExpense({ draft }: { draft: Draft | null }) {
  return (
    <>
      {" "}
      {draft ? (
        <section
          aria-label="Shared expense"
          className="grid gap-3 rounded-2xl border p-4"
        >
          <h2 className="font-heading text-xl">{draft.description}</h2>
          <p>
            {draft.amount_cents === null
              ? "Amount to be confirmed"
              : `Shared amount ${formatCentimesAsFrancs(draft.amount_cents)}`}
          </p>
          <p className="text-muted-foreground">
            {draft.status === "pending"
              ? "This draft doesn't affect your balance until you confirm it."
              : draft.status === "posted"
                ? "This expense has been posted to Money."
                : "This expense draft was dismissed."}
          </p>
          <Link
            className={buttonVariants({
              variant: "outline",
              className: "w-fit",
            })}
            href={
              draft.status === "pending"
                ? `/money/expenses/new?draft=${draft.id}`
                : "/money"
            }
          >
            {draft.status === "pending"
              ? "Review shared expense"
              : "Open Money"}
          </Link>
        </section>
      ) : (
        <p className="text-muted-foreground">
          No shared expense was created for this trip.
        </p>
      )}
    </>
  );
}
type Item = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
};
function ShoppingItems({ items }: { items: Item[] }) {
  return (
    <section aria-labelledby="purchased-items">
      <h2 className="font-heading text-xl" id="purchased-items">
        Purchased items
      </h2>
      <ul className="grid gap-2" role="list">
        {items.map((item) => (
          <li
            className="flex flex-wrap items-center justify-between gap-3 border-b py-3"
            key={item.id}
          >
            <div className="grid gap-1">
              <p className="font-medium">
                {item.name} ·{" "}
                {[item.quantity, item.unit].filter(Boolean).join(" ")}
              </p>
              {item.note ? (
                <p className="text-sm text-muted-foreground">{item.note}</p>
              ) : null}
            </div>
            <GroceryMutationButton
              action={buyGroceryAgainAction}
              once
              fields={{ itemId: item.id }}
              label={`Buy ${item.name} again`}
              successMessage="Added to the list"
            />
          </li>
        ))}
      </ul>
      {items.length === 0 ? (
        <p className="py-3 text-muted-foreground">
          Purchased items are kept for 30 days. Any shared expense remains in
          Money.
        </p>
      ) : null}
    </section>
  );
}
