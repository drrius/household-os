import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
export type GroceryCreationFields = {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  note?: string | null;
};
export async function acknowledgeGroceryCreation(
  id: string,
  input: GroceryCreationFields,
): Promise<{ id: string }> {
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const { data, error } = await db
    .from("grocery_items")
    .select("id,name,quantity,unit,category_id,note,state")
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();
  if (
    error ||
    !data ||
    !["active", "claimed"].includes(data.state) ||
    data.name !== input.name ||
    data.quantity !== (input.quantity ?? null) ||
    data.unit !== (input.unit ?? null) ||
    data.category_id !== (input.categoryId ?? null) ||
    data.note !== (input.note ?? null)
  )
    throw new Error(
      "This grocery addition already exists with changed details. Read the list before trying again.",
    );
  return { id: data.id };
}
