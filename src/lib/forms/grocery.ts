import { z } from "zod";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const shortTextSchema = z.string().trim().min(1).max(120);

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export type GroceryFormValue = {
  name: string;
  quantity: string | null;
  unit: string | null;
  categoryId: string | null;
  note: string | null;
};

export function parseGroceryForm(formData: FormData): GroceryFormValue {
  const categoryId = optionalText(formData.get("categoryId"));
  return {
    name: shortTextSchema.parse(requiredString(formData, "name")),
    quantity: optionalText(formData.get("quantity")),
    unit: optionalText(formData.get("unit")),
    categoryId: categoryId === null ? null : uuidSchema.parse(categoryId),
    note: optionalText(formData.get("note")),
  };
}
