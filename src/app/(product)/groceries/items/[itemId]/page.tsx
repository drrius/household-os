import { notFound } from "next/navigation";
import Link from "next/link";
import { z } from "zod";

import {
  removeGroceryItemAction,
  updateGroceryItemAction,
} from "@/lib/groceries/list-actions";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadGroceryFormOptions } from "@/lib/forms/options";
import { createClient } from "@/lib/supabase/server";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields, FormPage } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
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
      {item.originating_meal_plan_entry_id ? (
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

type EditableItem = {
  id: string;
  name: string;
  quantity: string | null;
  unit: string | null;
  note: string | null;
  category_id: string | null;
  updated_at: string;
  sort_order: number;
};
function GroceryEditForm({
  item,
  categories,
}: {
  item: EditableItem;
  categories: { id: string; name: string }[];
}) {
  return (
    <FormFields action={updateGroceryItemAction} submitLabel="Save item">
      <input name="itemId" type="hidden" value={item.id} />
      <input name="updatedAt" type="hidden" value={item.updated_at} />
      <FormField label="Item">
        <EchoedInput
          initialValue={item.name}
          maxLength={120}
          name="name"
          required
        />
      </FormField>
      <div className="grid grid-cols-2 gap-4">
        <FormField label="Quantity" optional>
          <EchoedInput
            initialValue={item.quantity ?? ""}
            maxLength={80}
            name="quantity"
          />
        </FormField>
        <FormField label="Unit" optional>
          <EchoedInput
            initialValue={item.unit ?? ""}
            maxLength={80}
            name="unit"
          />
        </FormField>
      </div>
      <FormField label="Category" optional>
        <EchoedSelect
          initialValue={item.category_id ?? ""}
          items={[
            { label: "Other", value: "" },
            ...categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
          name="categoryId"
        />
      </FormField>
      <FormField label="Note" optional>
        <EchoedTextarea
          initialValue={item.note ?? ""}
          maxLength={1000}
          name="note"
        />
      </FormField>
      <PositionField sortOrder={item.sort_order} />
    </FormFields>
  );
}

function PositionField({ sortOrder }: { sortOrder: number }) {
  return (
    <details className="rounded-xl border p-3">
      <summary className="min-h-11 cursor-pointer content-center font-medium">
        List position
      </summary>
      <FormField
        description="Lower numbers appear first in this category."
        label="Position"
      >
        <EchoedInput
          initialValue={String(sortOrder)}
          min={0}
          max={2147483647}
          name="sortOrder"
          required
          type="number"
        />
      </FormField>
    </details>
  );
}
