"use client";
import {
  groceryCategoryOptions,
  groceryCategorySelection,
  type GroceryCategoryOption,
} from "@/domain/groceries/category-options";
import { useState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { updateGroceryItemAction } from "@/lib/groceries/list-actions";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
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
type GroceryEditProps = {
  item: EditableItem;
  categories: GroceryCategoryOption[];
  action?: FormAction;
};
export function GroceryEditForm(props: GroceryEditProps) {
  return <GroceryEditSession key={props.item.id} {...props} />;
}
function GroceryEditSession({
  item: initialItem,
  categories,
  action = updateGroceryItemAction,
}: GroceryEditProps) {
  // Keep the concurrency token attached to the values this edit began with.
  const [item] = useState(initialItem);
  return (
    <FormFields action={action} submitLabel="Save item">
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
          initialValue={groceryCategorySelection(categories, item.category_id)}
          items={groceryCategoryOptions(categories)}
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
