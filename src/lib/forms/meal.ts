import { z } from "zod";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const dateSchema = z.iso.date("Choose a valid date.");
const shortTextSchema = z.string().trim().min(1).max(120);
const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner"]);

function requiredString(formData: FormData, name: string): string {
  const value = formData.get(name);
  if (typeof value !== "string") {
    throw new Error(`${name} is required.`);
  }
  return value;
}

function optionalText(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseOptionalRecipeUrl(formData: FormData): string | null {
  const recipeUrl = optionalText(formData.get("recipeUrl"));
  if (recipeUrl !== null) {
    const parsed = new URL(recipeUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Recipe links must use http or https.");
    }
  }
  return recipeUrl;
}

export type MealFormValue = {
  title: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  recipeUrl: string | null;
  notes: string | null;
  saveToLibrary: boolean;
  idempotencyKey: string;
};

export function parseMealForm(formData: FormData): MealFormValue {
  return {
    title: shortTextSchema.parse(requiredString(formData, "title")),
    date: dateSchema.parse(requiredString(formData, "date")),
    slot: mealSlotSchema.parse(requiredString(formData, "slot")),
    recipeUrl: parseOptionalRecipeUrl(formData),
    notes: optionalText(formData.get("notes")),
    saveToLibrary: formData.get("saveToLibrary") === "on",
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type PlaceFromLibraryFormValue = {
  libraryId: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  notes: string | null;
  idempotencyKey: string;
};

export function parsePlaceFromLibraryForm(
  formData: FormData,
): PlaceFromLibraryFormValue {
  return {
    libraryId: uuidSchema.parse(requiredString(formData, "libraryId")),
    date: dateSchema.parse(requiredString(formData, "date")),
    slot: mealSlotSchema.parse(requiredString(formData, "slot")),
    notes: optionalText(formData.get("notes")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type RemoveMealFormValue = {
  entryId: string;
  idempotencyKey: string;
};

export function parseRemoveMealForm(formData: FormData): RemoveMealFormValue {
  return {
    entryId: uuidSchema.parse(requiredString(formData, "entryId")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type UpdateMealFormValue = {
  entryId: string;
  title: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner";
  recipeUrl: string | null;
  notes: string | null;
  idempotencyKey: string;
};

export function parseUpdateMealForm(formData: FormData): UpdateMealFormValue {
  return {
    entryId: uuidSchema.parse(requiredString(formData, "entryId")),
    title: shortTextSchema.parse(requiredString(formData, "title")),
    date: dateSchema.parse(requiredString(formData, "date")),
    slot: mealSlotSchema.parse(requiredString(formData, "slot")),
    recipeUrl: parseOptionalRecipeUrl(formData),
    notes: optionalText(formData.get("notes")),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}
