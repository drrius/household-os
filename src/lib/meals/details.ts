import "server-only";

import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function loadMealConnections(entryId: string) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [groceries, prep] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("id, name, quantity, unit, state")
      .eq("household_id", member.householdId)
      .eq("originating_meal_plan_entry_id", entryId)
      .neq("state", "removed")
      .order("sort_order"),
    supabase
      .from("routine_occurrences")
      .select(
        "id, routine_id, due_date, status, routine:routines!inner(title, instructions)",
      )
      .eq("household_id", member.householdId)
      .eq("meal_plan_entry_id", entryId)
      .order("due_date"),
  ]);
  if (groceries.error || prep.error)
    throw new Error("Could not load this meal’s groceries and prep.");
  return {
    groceries: groceries.data,
    prep: z
      .array(
        z.object({
          id: z.string().uuid(),
          routine_id: z.string().uuid(),
          due_date: z.string(),
          status: z.enum(["open", "completed", "skipped"]),
          routine: z.object({
            title: z.string(),
            instructions: z.string().nullable(),
          }),
        }),
      )
      .parse(prep.data),
  };
}

export type MealConnections = Awaited<ReturnType<typeof loadMealConnections>>;

export async function loadMealLibraryChoices() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_definitions")
    .select("id, name")
    .eq("household_id", member.householdId)
    .is("archived_at", null)
    .order("name");
  if (error) throw new Error("Could not load saved meals.");
  return data.map((meal) => ({ id: meal.id, title: meal.name }));
}
