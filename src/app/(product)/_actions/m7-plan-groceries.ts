"use server";

import { redirect } from "next/navigation";
import {
  errorHref,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
import {
  parseGroceryForm,
  parseMealForm,
  parsePlaceFromLibraryForm,
  parseRemoveMealForm,
} from "@/lib/forms/m7";
import { createGroceryItem } from "@/lib/groceries/commands";
import {
  createAndPlaceMeal,
  placeMeal,
  removeMealPlanEntry,
} from "@/lib/meals/commands";

export async function createGroceryItemAction(
  formData: FormData,
): Promise<void> {
  let failure: unknown = null;
  try {
    await createGroceryItem(parseGroceryForm(formData));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) redirect(errorHref("/groceries/new", failure));
  revalidateProduct(["/", "/groceries"]);
  redirect("/groceries");
}

export async function createMealAction(formData: FormData): Promise<void> {
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
  if (failure !== null) redirect(errorHref("/plan/meals/new", failure));
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}

export async function placeFromLibraryAction(
  formData: FormData,
): Promise<void> {
  let failure: unknown = null;
  let libraryId: string | null = null;
  try {
    const input = parsePlaceFromLibraryForm(formData);
    libraryId = input.libraryId;
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
    const fallback =
      libraryId === null
        ? "/plan/meals/new"
        : `/plan/meals/new?libraryId=${encodeURIComponent(libraryId)}`;
    redirect(errorHref(fallback, failure));
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect("/plan");
}

export async function removeMealEntryAction(
  formData: FormData,
): Promise<void> {
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
