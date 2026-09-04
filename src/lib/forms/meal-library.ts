import { z } from "zod";

import { parseOptionalRecipeUrl } from "@/lib/forms/meal";

const id = z.string().uuid("Choose a valid meal.");
const optional = (value: FormDataEntryValue | null, max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullable()
    .parse(typeof value === "string" && value.trim() ? value : null);

export function parseLibraryMealForm(form: FormData) {
  return {
    id: id.parse(form.get("libraryId")),
    isNew: form.get("isNew") === "yes",
    name: z
      .string()
      .trim()
      .min(1, "Give this meal a name.")
      .max(120)
      .parse(form.get("name")),
    recipeUrl: parseOptionalRecipeUrl(form),
    notes: optional(form.get("notes"), 4000),
  };
}

export function parseMealTemplateForm(form: FormData) {
  const category = optional(form.get("categoryId"), 36);
  return {
    id: id.parse(form.get("templateId")),
    libraryId: id.parse(form.get("libraryId")),
    isNew: form.get("isNew") === "yes",
    name: z
      .string()
      .trim()
      .min(1, "Name the grocery item.")
      .max(120)
      .parse(form.get("name")),
    quantity: optional(form.get("quantity"), 80),
    unit: optional(form.get("unit"), 80),
    categoryId: category === null ? null : id.parse(category),
    note: optional(form.get("note"), 1000),
  };
}

export function parseMealLibraryId(form: FormData) {
  return id.parse(form.get("libraryId"));
}

export function parseMealTemplateId(form: FormData) {
  return id.parse(form.get("templateId"));
}
