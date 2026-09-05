"use client";
import { useState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { saveMealTemplateAction } from "@/app/(product)/plan/library/actions";
import type { LibraryMeal } from "@/lib/meals/library";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

export function MealTemplateEditor({
  id: initialId,
  action = saveMealTemplateAction,
  libraryId,
  date,
  categories,
  template,
}: {
  id: string;
  action?: FormAction;
  libraryId: string;
  date: string;
  categories: readonly { id: string; name: string }[];
  template?: LibraryMeal["templates"][number];
}) {
  const [id] = useState(initialId);
  return (
    <FormFields
      action={action}
      submitLabel={template ? "Save grocery" : "Add default grocery"}
    >
      <input type="hidden" name="libraryId" value={libraryId} />
      <input type="hidden" name="templateId" value={id} />
      <input type="hidden" name="isNew" value={template ? "no" : "yes"} />
      <input type="hidden" name="date" value={date} />
      <FormField label="Item">
        <EchoedInput
          name="name"
          initialValue={template?.name ?? ""}
          maxLength={120}
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Quantity" optional>
          <EchoedInput
            name="quantity"
            initialValue={template?.quantity ?? ""}
            maxLength={80}
            placeholder="e.g. 2"
          />
        </FormField>
        <FormField label="Unit" optional>
          <EchoedInput
            name="unit"
            initialValue={template?.unit ?? ""}
            maxLength={80}
            placeholder="e.g. packs"
          />
        </FormField>
      </div>
      <FormField label="Category" optional>
        <EchoedSelect
          name="categoryId"
          initialValue={template?.grocery_category_id ?? ""}
          items={[
            { label: "Other", value: "" },
            ...categories.map((category) => ({
              label: category.name,
              value: category.id,
            })),
          ]}
        />
      </FormField>
      <FormField label="Note" optional>
        <EchoedTextarea
          name="note"
          initialValue={template?.note ?? ""}
          maxLength={1000}
        />
      </FormField>
    </FormFields>
  );
}
