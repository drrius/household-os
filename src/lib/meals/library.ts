import "server-only";

import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import type {
  parseLibraryMealForm,
  parseMealTemplateForm,
} from "@/lib/forms/meal-library";
import { createClient } from "@/lib/supabase/server";

export async function loadLibraryMeal(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [meal, templates] = await Promise.all([
    supabase
      .from("meal_definitions")
      .select("id, name, recipe_url, notes, archived_at, updated_at")
      .eq("household_id", member.householdId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("meal_grocery_templates")
      .select(
        "id, name, quantity, unit, grocery_category_id, note, sort_order, archived_at, updated_at",
      )
      .eq("household_id", member.householdId)
      .eq("meal_definition_id", id)
      .order("sort_order")
      .order("id"),
  ]);
  if (meal.error || templates.error)
    throw new Error("Could not load this saved meal.");
  return meal.data
    ? {
        ...meal.data,
        templates: templates.data.filter(
          (template) => template.archived_at === null,
        ),
        archivedTemplates: templates.data.filter(
          (template) => template.archived_at !== null,
        ),
      }
    : null;
}

export type LibraryMeal = NonNullable<
  Awaited<ReturnType<typeof loadLibraryMeal>>
>;

export async function saveLibraryMeal(
  input: ReturnType<typeof parseLibraryMealForm>,
) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  if (input.isNew && input.sourceEntryId) {
    const { data, error } = await supabase.rpc("save_planned_meal_to_library", {
      p_entry_id: input.sourceEntryId,
      p_definition_id: input.id,
      p_name: input.name,
      p_recipe_url: input.recipeUrl,
      p_notes: input.notes,
    });
    if (error)
      throw new Error(
        "Could not save this planned meal. Refresh the plan and try again.",
      );
    return z.object({ meal_definition_id: z.string().uuid() }).parse(data)
      .meal_definition_id;
  }
  const fields = {
    name: input.name,
    recipe_url: input.recipeUrl,
    notes: input.notes,
  };
  if (input.isNew) {
    const { error } = await supabase
      .from("meal_definitions")
      .insert({ id: input.id, household_id: member.householdId, ...fields });
    if (error?.code === "23505") {
      const { data, error: readError } = await supabase
        .from("meal_definitions")
        .select("name, recipe_url, notes")
        .eq("household_id", member.householdId)
        .eq("id", input.id)
        .is("archived_at", null)
        .maybeSingle();
      if (
        !readError &&
        data &&
        data.name === fields.name &&
        data.recipe_url === fields.recipe_url &&
        data.notes === fields.notes
      )
        return input.id;
    }
    if (error) throw new Error("Could not save this meal. Try again.");
    return input.id;
  }
  const { data, error } = await supabase
    .from("meal_definitions")
    .update(fields)
    .eq("household_id", member.householdId)
    .eq("id", input.id)
    .eq("updated_at", input.version)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "This saved meal changed or is no longer available. Reload it before saving your edits.",
    );
  return input.id;
}

export async function archiveLibraryMeal(id: string) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_definitions")
    .update({ archived_at: new Date().toISOString() })
    .eq("household_id", member.householdId)
    .eq("id", id);
  if (error) throw new Error("Could not archive this meal. Try again.");
}

export async function saveMealTemplate(
  input: ReturnType<typeof parseMealTemplateForm>,
) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data: meal, error: mealError } = await supabase
    .from("meal_definitions")
    .select("id")
    .eq("household_id", member.householdId)
    .eq("id", input.libraryId)
    .is("archived_at", null)
    .maybeSingle();
  if (mealError || !meal)
    throw new Error("This saved meal is no longer available.");
  const fields = {
    name: input.name,
    quantity: input.quantity,
    unit: input.unit,
    grocery_category_id: input.categoryId,
    note: input.note,
  };
  if (input.isNew) {
    const { data: last, error: lastError } = await supabase
      .from("meal_grocery_templates")
      .select("sort_order")
      .eq("household_id", member.householdId)
      .eq("meal_definition_id", input.libraryId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lastError)
      throw new Error("Could not load default groceries. Try again.");
    const { error } = await supabase.from("meal_grocery_templates").insert({
      id: input.id,
      household_id: member.householdId,
      meal_definition_id: input.libraryId,
      sort_order: (last?.sort_order ?? -1) + 1,
      ...fields,
    });
    if (error?.code === "23505") {
      const { data, error: readError } = await supabase
        .from("meal_grocery_templates")
        .select("name, quantity, unit, grocery_category_id, note")
        .eq("household_id", member.householdId)
        .eq("meal_definition_id", input.libraryId)
        .eq("id", input.id)
        .is("archived_at", null)
        .maybeSingle();
      if (
        !readError &&
        data &&
        data.name === fields.name &&
        data.quantity === fields.quantity &&
        data.unit === fields.unit &&
        data.grocery_category_id === fields.grocery_category_id &&
        data.note === fields.note
      )
        return;
    }
    if (error)
      throw new Error(
        "Could not add this default grocery. Check its category and try again.",
      );
    return;
  }
  const { data, error } = await supabase
    .from("meal_grocery_templates")
    .update(fields)
    .eq("household_id", member.householdId)
    .eq("meal_definition_id", input.libraryId)
    .eq("id", input.id)
    .eq("updated_at", input.version)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "This grocery changed. Reload the saved meal and try again.",
    );
}

export async function removeMealTemplate(
  libraryId: string,
  templateId: string,
) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_grocery_templates")
    .update({ archived_at: new Date().toISOString() })
    .eq("household_id", member.householdId)
    .eq("meal_definition_id", libraryId)
    .eq("id", templateId);
  if (error)
    throw new Error("Could not remove this default grocery. Try again.");
}

export async function restoreMealTemplate(
  libraryId: string,
  templateId: string,
) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("meal_grocery_templates")
    .update({ archived_at: null })
    .eq("household_id", member.householdId)
    .eq("meal_definition_id", libraryId)
    .eq("id", templateId);
  if (error)
    throw new Error("Could not restore this default grocery. Try again.");
}
