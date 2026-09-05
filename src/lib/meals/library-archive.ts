import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function restoreLibraryMeal(id: string) {
  const member = await requireMemberContext();
  z.uuid().parse(id);
  const db = await createClient();
  const { data, error } = await db
    .from("meal_definitions")
    .update({ archived_at: null })
    .eq("household_id", member.householdId)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Could not restore this meal. Reload the archive and try again.",
    );
  return data.id;
}
export function archivedMealPage(value?: string) {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 ? Math.min(page, 1000000) : 1;
}
export async function loadArchivedLibraryMeals(page: number) {
  const member = await requireMemberContext();
  const db = await createClient();
  const { data, error, count } = await db
    .from("meal_definitions")
    .select("id,name,notes,archived_at", { count: "exact" })
    .eq("household_id", member.householdId)
    .not("archived_at", "is", null)
    .order("archived_at", { ascending: false })
    .order("id")
    .range((page - 1) * 20, page * 20 - 1);
  if (error) throw new Error("Could not load archived meals. Try again.");
  return { meals: data ?? [], page, total: count ?? 0 };
}
export type ArchivedLibrary = Awaited<
  ReturnType<typeof loadArchivedLibraryMeals>
>;
