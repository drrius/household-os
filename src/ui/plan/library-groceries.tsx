import { ArchivedMealGroceries } from "@/ui/plan/archived-meal-groceries";
import {
  archiveLibraryMealAction,
  removeMealTemplateAction,
} from "@/app/(product)/plan/library/actions";
import type { LibraryMeal } from "@/lib/meals/library";
import { FormFields } from "@/ui/forms/form-page";
import { MealTemplateForm } from "@/ui/plan/meal-template-form";

type LibraryGroceriesProps = {
  meal: LibraryMeal;
  date: string;
  categories: readonly { id: string; name: string }[];
};

function LibraryGrocery({
  meal,
  date,
  categories,
  template,
}: LibraryGroceriesProps & { template: LibraryMeal["templates"][number] }) {
  return (
    <li>
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer py-2 font-medium">
          {template.name}
          {template.quantity || template.unit
            ? ` · ${[template.quantity, template.unit].filter(Boolean).join(" ")}`
            : ""}
        </summary>
        <div className="grid gap-6 pt-4">
          <MealTemplateForm
            libraryId={meal.id}
            template={template}
            categories={categories}
            date={date}
          />
          <details className="border-t pt-4">
            <summary className="cursor-pointer py-2 text-muted-foreground">
              Remove this default grocery
            </summary>
            <div className="pt-3">
              <FormFields
                action={removeMealTemplateAction}
                submitLabel="Remove default grocery"
              >
                <input type="hidden" name="libraryId" value={meal.id} />
                <input type="hidden" name="templateId" value={template.id} />
                <input type="hidden" name="date" value={date} />
                <p>
                  Remove {template.name} from this saved meal? You can restore
                  it below. Items already on the shopping list stay there.
                </p>
              </FormFields>
            </div>
          </details>
        </div>
      </details>
    </li>
  );
}

export function LibraryGroceries({
  meal,
  date,
  categories,
}: LibraryGroceriesProps) {
  return (
    <section
      aria-labelledby="default-groceries-title"
      id="default-groceries"
      className="grid scroll-mt-6 gap-4 border-t pt-6"
    >
      <h2
        id="default-groceries-title"
        className="font-heading text-xl font-semibold"
      >
        Default groceries
      </h2>
      <p className="text-base text-muted-foreground sm:text-sm">
        These items join your shopping list when you plan this meal. Changes
        here apply the next time you plan it.
      </p>
      {meal.templates.length ? (
        <ul role="list" className="grid list-none gap-3">
          {meal.templates.map((template) => (
            <LibraryGrocery
              key={template.id}
              meal={meal}
              date={date}
              categories={categories}
              template={template}
            />
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground sm:text-sm">
          No default groceries yet.
        </p>
      )}
      <ArchivedMealGroceries meal={meal} date={date} />
      <details
        className="rounded-xl border p-4"
        open={meal.templates.length === 0}
      >
        <summary className="cursor-pointer py-2 font-medium">
          Add a default grocery
        </summary>
        <div className="pt-4">
          <MealTemplateForm
            libraryId={meal.id}
            categories={categories}
            date={date}
          />
        </div>
      </details>
    </section>
  );
}

export function ArchiveLibraryMeal({
  meal,
  date,
}: Pick<LibraryGroceriesProps, "meal" | "date">) {
  return (
    <details className="border-t pt-6">
      <summary className="cursor-pointer py-2 font-medium text-muted-foreground">
        Archive saved meal
      </summary>
      <div className="grid gap-4 pt-4">
        <p className="text-base text-muted-foreground sm:text-sm">
          Remove this meal from the library. Meals you’ve already planned and
          their groceries stay as they are.
        </p>
        <FormFields
          action={archiveLibraryMealAction}
          submitLabel="Archive meal"
        >
          <input type="hidden" name="libraryId" value={meal.id} />
          <input type="hidden" name="date" value={date} />
        </FormFields>
      </div>
    </details>
  );
}
