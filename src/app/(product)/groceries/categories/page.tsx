import { saveGroceryCategoryAction } from "@/lib/groceries/list-actions";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import {
  CheckboxField,
  FormField,
  FormFields,
  FormPage,
} from "@/ui/forms/form-page";

export default async function GroceryCategoriesPage() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_categories")
    .select("id, name, sort_order, archived_at")
    .eq("household_id", member.householdId)
    .order("archived_at", { nullsFirst: true })
    .order("sort_order")
    .order("id");
  if (error) throw new Error("Couldn't load grocery categories.");
  return (
    <FormPage
      backHref="/groceries"
      description="Arrange the list to match the way you shop. Lower positions appear first."
      title="Grocery categories"
    >
      <div className="grid gap-4">
        {(data ?? []).map((category) => (
          <CategoryEditor category={category} key={category.id} />
        ))}
        <details className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            Add a category
          </summary>
          <FormFields
            action={saveGroceryCategoryAction}
            submitLabel="Add category"
          >
            <FormField label="Name">
              <EchoedInput maxLength={80} name="name" required />
            </FormField>
            <FormField label="Position">
              <EchoedInput
                initialValue={String(
                  Math.min(
                    2147483647,
                    Math.max(
                      -10,
                      ...(data ?? []).map((category) => category.sort_order),
                    ) + 10,
                  ),
                )}
                min={0}
                max={2147483647}
                name="sortOrder"
                required
                type="number"
              />
            </FormField>
          </FormFields>
        </details>
      </div>
    </FormPage>
  );
}

function CategoryEditor({
  category,
}: {
  category: {
    id: string;
    name: string;
    sort_order: number;
    archived_at: string | null;
  };
}) {
  return (
    <details className="rounded-xl border p-4">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        {category.name}
        {category.archived_at ? " · Archived" : ""}
      </summary>
      <FormFields
        action={saveGroceryCategoryAction}
        submitLabel="Save category"
      >
        <input
          name="previousArchivedAt"
          type="hidden"
          value={category.archived_at ?? ""}
        />
        <input name="categoryId" type="hidden" value={category.id} />
        <input name="previousName" type="hidden" value={category.name} />
        <input
          name="previousSortOrder"
          type="hidden"
          value={category.sort_order}
        />
        <FormField label="Name">
          <EchoedInput
            initialValue={category.name}
            maxLength={80}
            name="name"
            required
          />
        </FormField>
        <FormField label="Position">
          <EchoedInput
            initialValue={String(category.sort_order)}
            min={0}
            max={2147483647}
            name="sortOrder"
            required
            type="number"
          />
        </FormField>
        <CheckboxField
          defaultChecked={category.archived_at !== null}
          label={
            category.archived_at
              ? "Keep category archived"
              : "Archive this category"
          }
          name="archive"
        />
        <p className="text-sm text-muted-foreground">
          Items in an archived category appear under Other. Uncheck to restore
          the category. Your purchased history is kept.
        </p>
      </FormFields>
    </details>
  );
}
