"use client";
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
export function GroceryEditForm({
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
