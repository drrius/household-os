import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { loadLibraryMeal } from "@/lib/meals/library";
import { librarySchemas } from "./definitions/library-tools";
export async function readLibraryTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_library_meal") {
    const value = librarySchemas.get_library_meal.parse(input);
    const meal = await loadLibraryMeal(value.libraryId);
    if (!meal) throw new Error("This saved meal is unavailable.");
    return { meal };
  }
  const value = librarySchemas.get_library_meals.parse(input);
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  let query = db
    .from("meal_definitions")
    .select("id,name,recipe_url,notes,archived_at,updated_at")
    .eq("household_id", householdId);
  query = value.archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  if (value.query)
    query = query.ilike("name", `%${value.query.replace(/[\\%_]/g, "\\$&")}%`);
  const { data, error } = await query
    .order("name")
    .order("id")
    .range(value.page * 30, value.page * 30 + 30);
  if (error || !data) throw new Error("Could not load the meal library.");
  return {
    meals: data.slice(0, 30),
    hasMore: data.length > 30,
    page: value.page,
  };
}
