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
  isLeftover: boolean;
};

const mealSlotSchema = z.enum(["breakfast", "lunch", "dinner"]).nullable();

const manageEntryRowSchema = z.object({
  id: z.string().uuid(),
  title_snapshot: z.string(),
  date: z.string(),
  slot: mealSlotSchema,
  notes: z.string().nullable(),
  leftover_of_entry_id: z.string().uuid().nullable(),
});

const libraryTitleRowSchema = z.object({
  name: z.string(),
});

export async function loadManageMealEntry(
  entryId: string,
): Promise<ManageMealEntry | null> {
  const parsedId = z.string().uuid().safeParse(entryId);
  if (!parsedId.success) {
    return null;
  }

  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("id, title_snapshot, date, slot, notes, leftover_of_entry_id")
    .eq("household_id", member.householdId)
    .eq("id", parsedId.data)
    .is("removed_at", null)
    .maybeSingle();

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
    isLeftover: row.leftover_of_entry_id !== null,
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
