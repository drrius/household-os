import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import { removeGroceryItemAction } from "@/lib/groceries/list-actions";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadGroceryFormOptions } from "@/lib/forms/options";
import { createClient } from "@/lib/supabase/server";
import { FormPage } from "@/ui/forms/form-page";
import { GroceryEditForm } from "@/ui/groceries/item-form.client";
import { RemoveGroceryControl } from "@/ui/groceries/remove-grocery-control.client";

export default async function GroceryItemPage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const { itemId } = await params;
  if (!z.string().uuid().safeParse(itemId).success) notFound();
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [result, categories] = await Promise.all([
    supabase
      .from("grocery_items")
      .select(
        "id, name, quantity, unit, category_id, note, sort_order, state, updated_at, originating_meal_plan_entry_id",
      )
      .eq("household_id", member.householdId)
      .eq("id", itemId)
      .in("state", ["active", "claimed"])
      .maybeSingle(),
    loadGroceryFormOptions(),
  ]);
  if (result.error) throw new Error("Couldn't load this grocery item.");
  if (!result.data) notFound();
  const item = result.data;
  const linkedMeal = item.originating_meal_plan_entry_id
    ? await supabase
        .from("meal_plan_entries")
        .select("id")
        .eq("household_id", member.householdId)
        .eq("id", item.originating_meal_plan_entry_id)
        .is("removed_at", null)
        .maybeSingle()
    : null;
  if (linkedMeal?.error) throw new Error("Couldn't load the linked meal.");
  return (
    <FormPage
      backHref="/groceries"
      description={
        item.state === "claimed"
          ? "This item is in a cart. Return it to the list before changing its details."
          : "Update the details for your next shop."
      }
      title={item.name}
    >
      {linkedMeal?.data ? (
        <p className="pb-4 text-sm">
          <Link
            className="underline underline-offset-4"
            href={`/plan/meals/${item.originating_meal_plan_entry_id}`}
          >
            View linked meal
          </Link>
        </p>
      ) : null}
      {item.state === "active" ? (
        <div className="grid gap-6">
          <GroceryEditForm categories={categories} item={item} />
          <RemoveGroceryControl
            action={removeGroceryItemAction}
            itemId={item.id}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          <p>{[item.quantity, item.unit].filter(Boolean).join(" ")}</p>
          <p>{item.note}</p>
          <Link
            className="inline-flex min-h-11 items-center underline"
            href="/groceries"
          >
            Back to the shopping list
          </Link>
        </div>
      )}
    </FormPage>
  );
}
