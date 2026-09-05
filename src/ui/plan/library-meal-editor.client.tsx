"use client";
import { useState, type FormEvent } from "react";
import { saveLibraryMealAction } from "@/app/(product)/plan/library/actions";
import type { LibraryMeal } from "@/lib/meals/library";
import type { FormAction } from "@/lib/forms/action-state";
import type { LibraryMealFormProps } from "./library-meal-form";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";

type EditorProps = LibraryMealFormProps & { id: string; action?: FormAction };
export function LibraryMealEditor(props: EditorProps) {
  const [id] = useState(props.id);
  const [snapshot, setSnapshot] = useState<LibraryMeal | null>(null);
  const meal = snapshot ?? props.meal;
  function capture(event: FormEvent) {
    if (!meal) return;
    const form =
      event.target instanceof Element ? event.target.closest("form") : null;
    if (!(form instanceof HTMLFormElement)) return;
    const values = new FormData(form);
    const dirty =
      values.get("name") !== meal.name ||
      values.get("recipeUrl") !== (meal.recipe_url ?? "") ||
      values.get("notes") !== (meal.notes ?? "");
    setSnapshot(dirty ? meal : null);
  }
  return (
    <div
      onInputCapture={capture}
      onChangeCapture={capture}
      onSubmitCapture={() => {
        if (meal) setSnapshot(meal);
      }}
    >
      <LibraryMealFields
        key={meal?.updated_at ?? "new"}
        {...props}
        id={id}
        meal={meal}
      />
    </div>
  );
}

function LibraryMealFields({
  id,
  meal,
  date,
  initial,
  sourceEntryId,
  action = saveLibraryMealAction,
}: EditorProps) {
  return (
    <FormFields action={action} submitLabel="Save meal">
      <input type="hidden" name="libraryId" value={id} />
      <input type="hidden" name="version" value={meal?.updated_at ?? ""} />
      <input type="hidden" name="isNew" value={meal ? "no" : "yes"} />
      <input type="hidden" name="date" value={date} />
      {sourceEntryId ? (
        <input type="hidden" name="sourceEntryId" value={sourceEntryId} />
      ) : null}
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
