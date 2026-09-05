import { groupGroceries } from "@/domain/groceries/order";
import { CheckoutCart } from "@/ui/groceries/checkout-cart";
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
  const [
    { data: unorderedItems, error: itemError },
    { data: categories, error: categoryError },
  ] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id, name, quantity, unit, category_id, sort_order")
      .eq("household_id", member.householdId)
      .eq("claimed_by_session_id", session.id)
      .eq("state", "claimed")
      .order("sort_order"),
    supabase
      .from("grocery_categories")
      .select("id, name, sort_order, is_fallback")
      .eq("household_id", member.householdId)
      .or("archived_at.is.null,is_fallback.eq.true"),
  ]);
  if (itemError || categoryError)
    throw new Error("Couldn't load your cart items.");
  const items = groupGroceries(categories ?? [], unorderedItems ?? []).flatMap(
    (group) => group.items,
  );
  return (
    <FormPage
      backHref="/groceries"
      description="Only items in your cart will move to purchased history. Your partner's cart stays open."
      title="Finish shopping"
    >
      <div className="grid gap-6">
        <CheckoutCart items={items} />
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
