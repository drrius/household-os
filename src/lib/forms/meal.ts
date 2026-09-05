import { z } from "zod";

import { startOfZurichWeek } from "@/lib/ui/zurich-date";

import { FormFieldError } from "@/lib/forms/field-error";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const dateSchema = z.iso.date("Choose a valid date.");
const shortTextSchema = z.string().trim().min(1).max(120);
const mealSlotSchema = z
  .enum(["breakfast", "lunch", "dinner", "idea"])
  .transform((slot) => (slot === "idea" ? null : slot));

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

// Named so the rejection lands under the Recipe link control, not only in the
// alert above the card. `type="url"` accepts ftp:, so the server still decides.
const recipeUrlError = () =>
  new FormFieldError(
    "recipeUrl",
    "Recipe links must start with http:// or https://.",
  );

export function parseOptionalRecipeUrl(formData: FormData): string | null {
  const recipeUrl = optionalText(formData.get("recipeUrl"));
  if (recipeUrl === null) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(recipeUrl);
  } catch {
    throw recipeUrlError();
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw recipeUrlError();
  }
  return z.string().max(2000).parse(recipeUrl);
}

export type MealFormValue = {
  title: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | null;
  recipeUrl: string | null;
  notes: string | null;
  saveToLibrary: boolean;
  idempotencyKey: string;
};

export function parseMealForm(formData: FormData): MealFormValue {
  return {
    title: shortTextSchema.parse(requiredString(formData, "title")),
    ...parseMealPosition(formData),
    recipeUrl: parseOptionalRecipeUrl(formData),
    notes: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("notes"))),
    saveToLibrary: formData.get("saveToLibrary") === "on",
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export type PlaceFromLibraryFormValue = {
  libraryId: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | null;
  notes: string | null;
  idempotencyKey: string;
};

export function parsePlaceFromLibraryForm(
  formData: FormData,
): PlaceFromLibraryFormValue {
  return {
    libraryId: uuidSchema.parse(requiredString(formData, "libraryId")),
    ...parseMealPosition(formData),
    notes: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("notes"))),
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
  slot: "breakfast" | "lunch" | "dinner" | null;
  recipeUrl: string | null;
  notes: string | null;
  idempotencyKey: string;
};

export function parseUpdateMealForm(formData: FormData): UpdateMealFormValue {
  return {
    entryId: uuidSchema.parse(requiredString(formData, "entryId")),
    title: shortTextSchema.parse(requiredString(formData, "title")),
    ...parseMealPosition(formData),
    recipeUrl: parseOptionalRecipeUrl(formData),
    notes: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("notes"))),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}

export function parseMealPosition(formData: FormData) {
  const slot = mealSlotSchema.parse(requiredString(formData, "slot"));
  const date = dateSchema.parse(requiredString(formData, "date"));
  return { date: slot === null ? startOfZurichWeek(date) : date, slot };
}

export function parseMoveMealForm(formData: FormData) {
  return { ...parseRemoveMealForm(formData), ...parseMealPosition(formData) };
}

export function parseLeftoverMealForm(formData: FormData) {
  return {
    ...parseMealPosition(formData),
    leftoverOfEntryId: uuidSchema.parse(
      requiredString(formData, "leftoverOfEntryId"),
    ),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
    notes: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("notes"))),
  };
}

export function parseMealPreparationForm(formData: FormData) {
  const assignedMemberId = optionalText(formData.get("assignedMemberId"));
  return {
    mealPlanEntryId: uuidSchema.parse(requiredString(formData, "entryId")),
    title: shortTextSchema.parse(requiredString(formData, "title")),
    dueOn: dateSchema.parse(requiredString(formData, "dueOn")),
    areaId: uuidSchema.parse(requiredString(formData, "areaId")),
    assignmentPolicy:
      assignedMemberId === null ? ("shared" as const) : ("assigned" as const),
    assignedMemberId:
      assignedMemberId === null ? null : uuidSchema.parse(assignedMemberId),
    instructions: z
      .string()
      .max(4000)
      .nullable()
      .parse(optionalText(formData.get("instructions"))),
    idempotencyKey: uuidSchema.parse(
      requiredString(formData, "idempotencyKey"),
    ),
  };
}
