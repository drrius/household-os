import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  saveLibraryMeal,
  saveMealTemplate,
  archiveLibraryMeal,
  removeMealTemplate,
  restoreMealTemplate,
  loadLibraryMeal,
} from "@/lib/meals/library";
import { restoreLibraryMeal } from "@/lib/meals/library-archive";
import {
  parseLibraryMealForm,
  parseMealTemplateForm,
} from "@/lib/forms/meal-library";
import { librarySchemas as schemas } from "../definitions/library-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
export const LIBRARY_HANDLERS: Record<string, AiWriteHandler> = {
  save_library_meal: async (input, { idempotencyKey }) => {
    const { identity, ...fields } = schemas.save_library_meal.parse(input);
    if (identity.mode === "update" && fields.sourceEntryId)
      throw new Error(
        "A source meal can only be selected when creating a library meal.",
      );
    const { householdId } = await requireMemberContext();
    const libraryId =
      identity.mode === "create"
        ? invocationRecordId(`${householdId}:${idempotencyKey}`)
        : identity.id;
    const value = parseLibraryMealForm(
      commandForm({
        ...fields,
        libraryId,
        isNew: identity.mode === "create" ? "yes" : "no",
        version: identity.mode === "update" ? identity.updatedAt : null,
      }),
    );
    return { libraryId: await saveLibraryMeal(value) };
  },
  save_meal_grocery_template: async (input, { idempotencyKey }) => {
    const { identity, ...fields } =
      schemas.save_meal_grocery_template.parse(input);
    const { householdId } = await requireMemberContext();
    const templateId =
      identity.mode === "create"
        ? invocationRecordId(`${householdId}:${idempotencyKey}`)
        : identity.id;
    const value = parseMealTemplateForm(
      commandForm({
        ...fields,
        templateId,
        isNew: identity.mode === "create" ? "yes" : "no",
        version: identity.mode === "update" ? identity.updatedAt : null,
      }),
    );
    await saveMealTemplate(value);
    return { libraryId: fields.libraryId, templateId };
  },
  set_library_meal_archived: async (input) => {
    const value = schemas.set_library_meal_archived.parse(input);
    if (!(await loadLibraryMeal(value.libraryId)))
      throw new Error("This saved meal is unavailable.");
    if (value.archived) await archiveLibraryMeal(value.libraryId);
    else await restoreLibraryMeal(value.libraryId);
    return { libraryId: value.libraryId };
  },
  set_meal_grocery_template_archived: async (input) => {
    const value = schemas.set_meal_grocery_template_archived.parse(input);
    const meal = await loadLibraryMeal(value.libraryId);
    if (
      !meal ||
      ![...meal.templates, ...meal.archivedTemplates].some(
        (item) => item.id === value.templateId,
      )
    )
      throw new Error(
        "This default grocery is unavailable in this saved meal.",
      );
    if (value.archived)
      await removeMealTemplate(value.libraryId, value.templateId);
    else await restoreMealTemplate(value.libraryId, value.templateId);
    return { templateId: value.templateId };
  },
};
