"use server";
import { withSearchReturn } from "@/lib/search/save-return";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { parseGroceryForm } from "@/lib/forms/grocery";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { createGroceryItem, removeGroceryItem } from "./commands";
import {
  buyGroceryAgain,
  saveGroceryCategory,
  updateGroceryItem,
} from "./item-commands";
const groceryItemIdSchema = z.string().uuid();
function revalidateGroceryViews() {
  revalidatePath("/groceries");
  revalidatePath("/");
}
export async function quickAddGroceryAction(formData: FormData): Promise<void> {
  await createGroceryItem(parseGroceryForm(formData));
  revalidateGroceryViews();
}

export async function updateGroceryItemAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await updateGroceryItem({
      ...parseGroceryForm(formData),
      itemId: groceryItemIdSchema.parse(formData.get("itemId")),
      updatedAt: z.iso
        .datetime({ offset: true })
        .parse(formData.get("updatedAt")),
      sortOrder: z.coerce
        .number()
        .int()
        .min(0)
        .max(2147483647)
        .parse(formData.get("sortOrder")),
    });
  });
  if (rejected) return rejected;
  revalidateGroceryViews();
  redirect(withSearchReturn("/groceries", formData));
}

export async function removeGroceryItemAction(
  formData: FormData,
): Promise<void> {
  await removeGroceryItem(groceryItemIdSchema.parse(formData.get("itemId")));
  revalidateGroceryViews();
}

export async function buyGroceryAgainAction(formData: FormData): Promise<void> {
  await buyGroceryAgain(groceryItemIdSchema.parse(formData.get("itemId")));
  revalidateGroceryViews();
}

export async function saveGroceryCategoryAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await saveGroceryCategory({
      categoryId: formData.get("categoryId")
        ? groceryItemIdSchema.parse(formData.get("categoryId"))
        : null,
      name: z.string().trim().min(1).max(80).parse(formData.get("name")),
      sortOrder: z.coerce
        .number()
        .int()
        .min(0)
        .max(2147483647)
        .parse(formData.get("sortOrder")),
      previousName: z.string().parse(formData.get("previousName") ?? ""),
      previousSortOrder: z.coerce
        .number()
        .int()
        .parse(formData.get("previousSortOrder") ?? 0),
      previousArchivedAt: formData.get("previousArchivedAt")
        ? z.iso
            .datetime({ offset: true })
            .parse(formData.get("previousArchivedAt"))
        : null,
      archive: formData.get("archive") === "on",
    });
  });
  if (rejected) return rejected;
  revalidateGroceryViews();
  revalidatePath("/groceries/categories");
  redirect("/groceries/categories");
}
