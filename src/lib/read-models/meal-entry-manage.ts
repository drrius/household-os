import "server-only";

import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export type ManageMealEntry = {
  id: string;
  title: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | null;
  notes: string | null;
  recipeUrl: string | null;
  isLeftover: boolean;
  removedAt?: string | null;
  libraryId?: string | null;
  leftoverOfEntryId?: string | null;
};

const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner"]).nullable();

const manageEntryRowSchema = z.object({
  id: z.string().uuid(),
  title_snapshot: z.string(),
  date: z.string(),
  slot: mealSlotSchema,
  notes: z.string().nullable(),
  recipe_url_snapshot: z.string().nullable(),
  meal_definition_id: z.string().uuid().nullable(),
  leftover_of_entry_id: z.string().uuid().nullable(),
  removed_at: z.string().nullable(),
});

const libraryTitleRowSchema = z.object({
  name: z.string(),
});

export async function loadManageMealEntry(
  entryId: string,
  includeRemoved = false,
): Promise<ManageMealEntry | null> {
  const parsedId = z.string().uuid().safeParse(entryId);
  if (!parsedId.success) {
    return null;
  }

  const member = await requireMemberContext();
  const supabase = await createClient();
  let query = supabase
    .from("meal_plan_entries")
    .select(
      "id, title_snapshot, date, slot, notes, recipe_url_snapshot, leftover_of_entry_id, meal_definition_id, removed_at",
    )
    .eq("household_id", member.householdId)
    .eq("id", parsedId.data);
  if (!includeRemoved) query = query.is("removed_at", null);
  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(`Meal entry lookup failed: ${error.message}`);
  }
  if (data === null) {
    return null;
  }

  const row = manageEntryRowSchema.parse(data);
  return {
    id: row.id,
    title: row.title_snapshot,
    date: row.date,
    slot: row.slot,
    notes: row.notes,
    recipeUrl: row.recipe_url_snapshot,
    isLeftover: row.leftover_of_entry_id !== null,
    libraryId: row.meal_definition_id,
    leftoverOfEntryId: row.leftover_of_entry_id,
    removedAt: row.removed_at,
  };
}

export async function loadLibraryMealTitle(
  libraryId: string,
): Promise<string | null> {
  const parsedId = z.string().uuid().safeParse(libraryId);
  if (!parsedId.success) {
    return null;
  }

  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_definitions")
    .select("name")
    .eq("household_id", member.householdId)
    .eq("id", parsedId.data)
    .is("archived_at", null)
    .maybeSingle();

  if (error) {
    throw new Error(`Meal library lookup failed: ${error.message}`);
  }
  if (data === null) {
    return null;
  }

  return libraryTitleRowSchema.parse(data).name;
}
