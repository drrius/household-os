import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cancelShoppingSessionAction,
  finishShoppingCheckoutAction,
} from "@/app/(product)/_actions/groceries";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { createClient } from "@/lib/supabase/server";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { CancelShoppingControl } from "@/ui/groceries/cancel-shopping-control.client";
import { CheckoutForm } from "@/ui/groceries/checkout-form.client";

export default async function ShoppingCheckoutPage() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [{ data: session, error }, { members }] = await Promise.all([
    supabase
      .from("shopping_sessions")
      .select("id")
      .eq("household_id", member.householdId)
      .eq("member_id", member.userId)
      .is("finished_at", null)
      .maybeSingle(),
    loadMoneyFormOptions(),
  ]);
  if (error) throw new Error("Couldn't load your cart.");
  if (!session) redirect("/groceries");
  const { data: items, error: itemError } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, unit")
    .eq("household_id", member.householdId)
    .eq("claimed_by_session_id", session.id)
    .eq("state", "claimed")
    .order("sort_order");
  if (itemError) throw new Error("Couldn't load your cart items.");
  return (
    <FormPage
      backHref="/groceries"
      description="Only items in your cart will move to purchased history. Your partner's cart stays open."
      title="Finish shopping"
    >
      <div className="grid gap-6">
        <details open className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            Your cart · {items?.length ?? 0} items
          </summary>
          <ul className="grid gap-2" role="list">
            {(items ?? []).map((item) => (
              <li className="flex justify-between gap-3" key={item.id}>
                <span>{item.name}</span>
                <span className="text-muted-foreground">
                  {[item.quantity, item.unit].filter(Boolean).join(" ")}
                </span>
              </li>
            ))}
          </ul>
          <Link
            className="inline-flex min-h-11 items-center underline"
            href="/groceries"
          >
            Adjust your cart
          </Link>
        </details>
        {items?.length ? (
          <CheckoutForm
            action={finishShoppingCheckoutAction}
            idempotencyKey={crypto.randomUUID()}
            members={members}
            occurredOn={zurichCivilDate()}
            sessionId={session.id}
            viewerId={member.userId}
          />
        ) : (
          <p>
            Your cart is empty. Add items from the list or end this shopping
            session.
          </p>
        )}
        <CancelShoppingControl
          action={cancelShoppingSessionAction}
          sessionId={session.id}
        />
      </div>
    </FormPage>
  );
}
