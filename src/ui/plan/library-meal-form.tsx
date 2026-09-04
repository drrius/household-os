import { saveLibraryMealAction } from "@/app/(product)/plan/library/actions";
import type { LibraryMeal } from "@/lib/meals/library";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";

export function LibraryMealForm({
  meal,
  date,
  initial,
}: {
  meal?: LibraryMeal;
  date: string;
  initial?: { title: string; recipeUrl: string | null; notes: string | null };
}) {
  return (
    <FormFields action={saveLibraryMealAction} submitLabel="Save meal">
      <input
        type="hidden"
        name="libraryId"
        value={meal?.id ?? crypto.randomUUID()}
      />
      <input type="hidden" name="isNew" value={meal ? "no" : "yes"} />
      <input type="hidden" name="date" value={date} />
      <FormField label="Meal name">
        <EchoedInput
          name="name"
          initialValue={meal?.name ?? initial?.title ?? ""}
          maxLength={120}
          required
        />
      </FormField>
      <FormField label="Recipe link" optional>
        <EchoedInput
          name="recipeUrl"
          initialValue={meal?.recipe_url ?? initial?.recipeUrl ?? ""}
          type="url"
          maxLength={2000}
        />
      </FormField>
      <FormField label="Notes" optional>
        <EchoedTextarea
          name="notes"
          initialValue={meal?.notes ?? initial?.notes ?? ""}
          maxLength={4000}
        />
      </FormField>
    </FormFields>
  );
}
