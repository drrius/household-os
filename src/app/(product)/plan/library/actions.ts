"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  parseLibraryMealForm,
  parseMealTemplateForm,
  parseMealLibraryId,
  parseMealTemplateId,
} from "@/lib/forms/meal-library";
import { restoreLibraryMeal } from "@/lib/meals/library-archive";
import { mealDate, mealPlanHref } from "@/lib/forms/meal-navigation";
import {
  saveLibraryMeal,
  saveMealTemplate,
  archiveLibraryMeal,
  removeMealTemplate,
  restoreMealTemplate,
} from "@/lib/meals/library";

export async function saveLibraryMealAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const input = parseLibraryMealForm(form);
    id = await saveLibraryMeal(input);
  });
  if (rejected) return rejected;
  revalidatePath("/plan");
  revalidatePath(`/plan/library/${id}`);
  redirect(`/plan/library/${id}?date=${mealDate(form.get("date"))}`);
}

export async function archiveLibraryMealAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, form, async () => {
    await archiveLibraryMeal(parseMealLibraryId(form));
  });
  if (rejected) return rejected;
  revalidatePath("/plan", "layout");
  redirect(mealPlanHref(mealDate(form.get("date"))));
}

export async function saveMealTemplateAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const input = parseMealTemplateForm(form);
    id = input.libraryId;
    await saveMealTemplate(input);
  });
  if (rejected) return rejected;
  revalidatePath(`/plan/library/${id}`);
  redirect(
    `/plan/library/${id}?date=${mealDate(form.get("date"))}#default-groceries`,
  );
}

export async function removeMealTemplateAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    id = parseMealLibraryId(form);
    await removeMealTemplate(id, parseMealTemplateId(form));
  });
  if (rejected) return rejected;
  revalidatePath(`/plan/library/${id}`);
  redirect(
    `/plan/library/${id}?date=${mealDate(form.get("date"))}#default-groceries`,
  );
}

export async function restoreMealTemplateAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    id = parseMealLibraryId(form);
    await restoreMealTemplate(id, parseMealTemplateId(form));
  });
  if (rejected) return rejected;
  revalidatePath(`/plan/library/${id}`);
  redirect(
    `/plan/library/${id}?date=${mealDate(form.get("date"))}#default-groceries`,
  );
}

export async function restoreLibraryMealAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    id = await restoreLibraryMeal(parseMealLibraryId(form));
  });
  if (rejected) return rejected;
  revalidatePath("/plan", "layout");
  redirect(`/plan/library/${id}?date=${mealDate(form.get("date"))}`);
}
