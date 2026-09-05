import { saveGroceryCategoryAction } from "@/lib/groceries/list-actions";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { GroceryCategoryManager } from "@/ui/groceries/category-manager.client";

export default async function GroceryCategoriesPage() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_categories")
    .select("id, name, sort_order, archived_at")
    .eq("household_id", member.householdId)
    .order("archived_at", { nullsFirst: true })
    .order("sort_order")
    .order("id");
  if (error) throw new Error("Couldn't load grocery categories.");
  return (
    <GroceryCategoryManager
      data={data ?? []}
      action={saveGroceryCategoryAction}
    />
  );
}
