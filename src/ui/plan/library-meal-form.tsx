import type { LibraryMeal } from "@/lib/meals/library";
import { LibraryMealEditor } from "./library-meal-editor.client";

export type LibraryMealFormProps = {
  meal?: LibraryMeal;
  date: string;
  sourceEntryId?: string;
  initial?: { title: string; recipeUrl: string | null; notes: string | null };
};

export function LibraryMealForm(props: LibraryMealFormProps) {
  return (
    <LibraryMealEditor
      key={props.meal?.id ?? props.sourceEntryId ?? "new"}
      {...props}
      id={props.meal?.id ?? crypto.randomUUID()}
    />
  );
}
