"use client";
import { useState, type FormEvent } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import {
  CheckboxField,
  FormField,
  FormFields,
  FormPage,
} from "@/ui/forms/form-page";
export type GroceryCategory = {
  id: string;
  name: string;
  sort_order: number;
  archived_at: string | null;
};
export function GroceryCategoryManager({
  data,
  action,
}: {
  data: GroceryCategory[];
  action: FormAction;
}) {
  return (
    <FormPage
      backHref="/groceries"
      description="Arrange the list to match the way you shop. Lower positions appear first."
      title="Grocery categories"
    >
      <div className="grid gap-4">
        {(data ?? []).map((category) => (
          <CategoryEditor
            category={category}
            key={category.id}
            action={action}
          />
        ))}
        <details className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer content-center font-semibold">
            Add a category
          </summary>
          <FormFields action={action} submitLabel="Add category">
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
  category: initialCategory,
  action,
}: {
  action: FormAction;
  category: {
    id: string;
    name: string;
    sort_order: number;
    archived_at: string | null;
  };
}) {
  const [snapshot, setSnapshot] = useState<GroceryCategory | null>(null);
  const category = snapshot ?? initialCategory;
  function captureChanges(event: FormEvent) {
    const form =
      event.target instanceof Element ? event.target.closest("form") : null;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const dirty =
      values.get("name") !== category.name ||
      values.get("sortOrder") !== String(category.sort_order) ||
      values.has("archive") !== (category.archived_at !== null);
    setSnapshot(dirty ? category : null);
  }
  return (
    <details
      className="rounded-xl border p-4"
      onInputCapture={captureChanges}
      onChangeCapture={captureChanges}
      onSubmitCapture={() => setSnapshot(category)}
    >
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        {category.name}
        {category.archived_at ? " · Archived" : ""}
      </summary>
      <CategoryFields
        key={JSON.stringify([
          category.name,
          category.sort_order,
          category.archived_at,
        ])}
        category={category}
        action={action}
      />
    </details>
  );
}

function CategoryFields({
  category,
  action,
}: {
  category: GroceryCategory;
  action: FormAction;
}) {
  return (
    <FormFields action={action} submitLabel="Save category">
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
        Items in an archived category appear under Other. Uncheck to restore the
        category. Your purchased history is kept.
      </p>
    </FormFields>
  );
}
