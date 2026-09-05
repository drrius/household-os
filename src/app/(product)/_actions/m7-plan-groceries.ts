"use server";
import { withSearchReturn } from "@/lib/search/save-return";

import { redirect } from "next/navigation";

import {
  errorHref,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { mealDate, mealPlanHref } from "@/lib/forms/meal-navigation";
import { parseGroceryForm } from "@/lib/forms/grocery";
import {
  parseMealForm,
  parseMoveMealForm,
  parseLeftoverMealForm,
  parseMealPreparationForm,
  parsePlaceFromLibraryForm,
  parseRemoveMealForm,
  parseUpdateMealForm,
} from "@/lib/forms/meal";
import { createGroceryItem } from "@/lib/groceries/commands";
import {
  createAndPlaceMeal,
  createMealPreparation,
  moveMealPlanEntry,
  placeMeal,
  removeMealPlanEntry,
  updateMealPlanEntry,
} from "@/lib/meals/commands";

export async function createGroceryItemAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await createGroceryItem(parseGroceryForm(formData));
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/groceries"]);
  redirect("/groceries");
}

export async function createMealAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
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
      return;
    }
    await placeMeal({
      date: input.date,
      slot: input.slot,
      sourceKind: "freeform",
      title: input.title,
      recipeUrl: input.recipeUrl,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

export async function placeFromLibraryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const input = parsePlaceFromLibraryForm(formData);
    await placeMeal({
      date: input.date,
      slot: input.slot,
      sourceKind: "library",
      mealDefinitionId: input.libraryId,
      notes: input.notes,
      idempotencyKey: input.idempotencyKey,
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

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
      entryId === null
        ? "/plan"
        : `/plan/meals/${encodeURIComponent(entryId)}/edit`;
    redirect(errorHref(fallback, failure));
  }
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

export async function updateMealEntryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
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
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

export async function moveMealEntryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await moveMealPlanEntry(parseMoveMealForm(formData));
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan", "/groceries"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

export async function placeLeftoverMealAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await placeMeal({
      ...parseLeftoverMealForm(formData),
      sourceKind: "leftover",
    });
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan"]);
  redirect(
    withSearchReturn(mealPlanHref(mealDate(formData.get("date"))), formData),
  );
}

export async function createMealPreparationAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let entryId = "";
  const rejected = await settleFormAction(previous, formData, async () => {
    const input = parseMealPreparationForm(formData);
    entryId = input.mealPlanEntryId;
    await createMealPreparation(input);
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/plan", `/plan/meals/${entryId}`]);
  redirect(`/plan/meals/${entryId}`);
}
