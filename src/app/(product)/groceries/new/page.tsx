import { createGroceryItemAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadGroceryFormOptions } from "@/lib/forms/options";
import {
  FormField,
  FormFields,
  FormPage,
  selectClassName,
} from "@/ui/forms/form-page";

export default async function NewGroceryPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [categories, query] = await Promise.all([
    loadGroceryFormOptions(),
    searchParams,
  ]);
  return (
    <FormPage
      backHref="/groceries"
      description="Add one item without silently combining quantities or units."
      error={query.error}
      title="New grocery item"
    >
      <FormFields
        action={createGroceryItemAction}
        submitLabel="Add to groceries"
      >
        <FormField label="Item">
          <Input maxLength={120} name="name" required />
        </FormField>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Quantity">
            <Input maxLength={80} name="quantity" />
          </FormField>
          <FormField label="Unit">
            <Input maxLength={80} name="unit" />
          </FormField>
        </div>
        <FormField label="Category">
          <select className={selectClassName} name="categoryId">
            <option value="">Other</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Note">
          <Textarea maxLength={1000} name="note" />
        </FormField>
      </FormFields>
    </FormPage>
  );
}
