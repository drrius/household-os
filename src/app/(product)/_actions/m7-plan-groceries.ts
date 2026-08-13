"use server";

import { redirect } from "next/navigation";
import {
  echoValues,
  errorHref,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
import {
  formRejection,
  parseGroceryForm,
  parseMealForm,
  parsePlaceFromLibraryForm,
  parseRemoveMealForm,
  parseUpdateMealForm,
} from "@/lib/forms/m7";
import { createGroceryItem } from "@/lib/groceries/commands";
import {
  createAndPlaceMeal,
  placeMeal,
  removeMealPlanEntry,
  updateMealPlanEntry,
} from "@/lib/meals/commands";
import type { FormActionState } from "@/ui/forms/form-action";

const mealEchoNames = ["title", "date", "slot", "recipeUrl", "notes"] as const;

export async function createGroceryItemAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let failure: unknown = null;
  try {
    await createGroceryItem(parseGroceryForm(formData));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return formRejection(
      previous,
      failure,
      echoValues(formData, ["name", "quantity", "unit", "categoryId", "note"]),
    );
  }
  revalidateProduct(["/", "/groceries"]);
  redirect("/groceries");
}

export async function createMealAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let failure: unknown = null;
  try {
    const input = parseMealForm(formData);
    if (input.saveToLibrary) {
      await createAndPlaceMeal({
        name: input.title,
        date: input.date,
        slot: input.slot,
        idempotencyKey: input.idempotencyKey,
        recipeUrl: input.recipeUrl,
        notes: input.notes,
      });
    } else {
      await placeMeal({
        date: input.date,
        slot: input.slot,
        sourceKind: "freeform",
        title: input.title,
        recipeUrl: input.recipeUrl,
        notes: input.notes,
        idempotencyKey: input.idempotencyKey,
      });
    }
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return formRejection(
      previous,
      failure,
      echoValues(formData, mealEchoNames),
    );
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}

export async function placeFromLibraryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let failure: unknown = null;
  try {
    const input = parsePlaceFromLibraryForm(formData);
    await placeMeal({
      date: input.date,
      slot: input.slot,
      sourceKind: "library",
      mealDefinitionId: input.libraryId,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return formRejection(
      previous,
      failure,
      echoValues(formData, ["date", "slot", "notes"]),
    );
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}

/**
 * Bound to a plain `<form action>` rather than `FormFields`, and it carries no
 * typed values, so it keeps the page-level `?error=` path.
 */
export async function removeMealEntryAction(formData: FormData): Promise<void> {
  let failure: unknown = null;
  let entryId: string | null = null;
  try {
    const input = parseRemoveMealForm(formData);
    entryId = input.entryId;
    await removeMealPlanEntry({
      entryId: input.entryId,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    const fallback =
      entryId === null ? "/plan" : `/plan/meals/${encodeURIComponent(entryId)}`;
    redirect(errorHref(fallback, failure));
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}

export async function updateMealEntryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let failure: unknown = null;
  try {
    const input = parseUpdateMealForm(formData);
    await updateMealPlanEntry({
      entryId: input.entryId,
      title: input.title,
      date: input.date,
      slot: input.slot,
      recipeUrl: input.recipeUrl,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return formRejection(
      previous,
      failure,
      echoValues(formData, mealEchoNames),
    );
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}
