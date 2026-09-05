import { groceryCategoryOptions } from "@/domain/groceries/category-options";
import { createGroceryItemAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { loadGroceryFormOptions } from "@/lib/forms/options";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields, FormPage } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

export default async function NewGroceryPage() {
  const categories = await loadGroceryFormOptions();
  return (
    <FormPage
      backHref="/groceries"
      description="Add one item to the shopping list."
      title="New grocery item"
    >
      <FormFields
        action={createGroceryItemAction}
        submitLabel="Add to groceries"
      >
        <FormField label="Item">
          <EchoedInput maxLength={120} name="name" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            description="Just the amount, e.g. 2"
            label="Quantity"
            optional
          >
            <EchoedInput maxLength={80} name="quantity" />
          </FormField>
          <FormField
            description="e.g. cartons, kg, packs"
            label="Unit"
            optional
          >
            <EchoedInput maxLength={80} name="unit" />
          </FormField>
        </div>
        <FormField label="Category" optional>
          <EchoedSelect
            items={groceryCategoryOptions(categories)}
            name="categoryId"
          />
        </FormField>
        <FormField label="Note" optional>
          <EchoedTextarea maxLength={1000} name="note" />
        </FormField>
      </FormFields>
    </FormPage>
  );
}
