import { restoreMealTemplateAction } from "@/app/(product)/plan/library/actions";
import type { LibraryMeal } from "@/lib/meals/library";
import { FormFields } from "@/ui/forms/form-page";

export function ArchivedMealGroceries({
  meal,
  date,
}: {
  meal: LibraryMeal;
  date: string;
}) {
  if (!meal.archivedTemplates.length) return null;
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer py-2 font-medium">
        Removed default groceries ({meal.archivedTemplates.length})
      </summary>
      <p className="py-3 text-sm text-muted-foreground">
        Restore an item to include it the next time you plan this meal. Existing
        shopping items stay as they are.
      </p>
      <ul className="grid list-none gap-4">
        {meal.archivedTemplates.map((template) => (
          <li className="grid gap-2 border-t pt-4" key={template.id}>
            <p className="font-medium">{template.name}</p>
            <FormFields
              action={restoreMealTemplateAction}
              submitLabel={`Restore ${template.name}`}
            >
              <input type="hidden" name="libraryId" value={meal.id} />
              <input type="hidden" name="templateId" value={template.id} />
              <input type="hidden" name="date" value={date} />
            </FormFields>
          </li>
        ))}
      </ul>
    </details>
  );
}
