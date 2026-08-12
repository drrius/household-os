"use server";

import { redirect } from "next/navigation";
import {
  errorHref,
  revalidateProduct,
} from "@/app/(product)/_actions/m7-shared";
import { parseGroceryForm, parseMealForm } from "@/lib/forms/m7";
import { createGroceryItem } from "@/lib/groceries/commands";
import { createAndPlaceMeal, placeMeal } from "@/lib/meals/commands";

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
