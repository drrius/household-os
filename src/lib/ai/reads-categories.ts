import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { categorySchemas } from "./definitions/category-tools";
export async function readGroceryCategories(input: unknown) {
  const { archived, page } =
    categorySchemas.get_grocery_categories.parse(input);
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  let query = db
    .from("grocery_categories")
    .select("id,name,sort_order,archived_at")
    .eq("household_id", householdId);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data, error } = await query
    .order("sort_order")
    .order("id")
    .range(page * 30, page * 30 + 30);
  if (error || !data) throw new Error("Could not load grocery categories.");
  return { categories: data.slice(0, 30), hasMore: data.length > 30, page };
}
