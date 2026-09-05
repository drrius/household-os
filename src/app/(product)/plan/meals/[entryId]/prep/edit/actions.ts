"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { parseMealPreparationEdit } from "@/lib/forms/meal-preparation";
import { updateMealPreparation } from "@/lib/meals/preparation";
export async function updateMealPreparationAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const input = parseMealPreparationEdit(form);
    id = input.entryId;
    await updateMealPreparation(input);
  });
  if (rejected) return rejected;
  revalidatePath("/");
  revalidatePath("/home");
  revalidatePath("/plan");
  redirect(`/plan/meals/${id}`);
}
