import "server-only";
import { createGroceryCategory } from "./category-create";

import { requireMemberContext } from "@/lib/auth/member-context";
import type { GroceryFormValue } from "@/lib/forms/grocery";
import { createGroceryItem } from "@/lib/groceries/commands";
import { createClient } from "@/lib/supabase/server";

export async function updateGroceryItem(
  input: GroceryFormValue & {
    itemId: string;
    updatedAt: string;
    sortOrder: number;
  },
) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .update({
      name: input.name,
      quantity: input.quantity,
      unit: input.unit,
      category_id: input.categoryId,
      note: input.note,
      sort_order: input.sortOrder,
    })
    .eq("id", input.itemId)
    .eq("household_id", member.householdId)
    .eq("updated_at", input.updatedAt)
    .eq("state", "active")
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`update_grocery_item failed: ${error.message}`);
  if (!data) {
    throw new Error(
      "This item changed or is already in a cart. Reopen it to see the latest details.",
    );
  }
}

export async function buyGroceryAgain(itemId: string, creationId?: string) {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("name, quantity, unit, category_id, note")
    .eq("id", itemId)
    .eq("household_id", member.householdId)
    .eq("state", "purchased")
    .single();
  if (error) throw new Error(`grocery_history_lookup failed: ${error.message}`);
  let categoryId = data.category_id;
  if (categoryId !== null) {
    const category = await supabase
      .from("grocery_categories")
      .select("id")
      .eq("household_id", member.householdId)
      .eq("id", categoryId)
      .is("archived_at", null)
      .maybeSingle();
    if (category.error)
      throw new Error(
        `grocery_category_lookup failed: ${category.error.message}`,
      );
    categoryId = category.data?.id ?? null;
  }
  return createGroceryItem({
    ...(creationId ? { creationId } : {}),
    name: data.name,
    quantity: data.quantity,
    unit: data.unit,
    categoryId,
    note: data.note,
  });
}

export async function saveGroceryCategory(input: {
  creationId?: string;
  categoryId: string | null;
  name: string;
  sortOrder: number;
  previousName: string;
  previousSortOrder: number;
  previousArchivedAt?: string | null;
  archive: boolean;
}) {
  if (input.categoryId === null)
    return createGroceryCategory(input.name, input.sortOrder, input.creationId);
  const member = await requireMemberContext();
  const supabase = await createClient();
  const values = { name: input.name, sort_order: input.sortOrder };
  let query = supabase
    .from("grocery_categories")
    .update({
      ...values,
      archived_at: input.archive ? new Date().toISOString() : null,
    })
    .eq("id", input.categoryId)
    .eq("household_id", member.householdId)
    .eq("name", input.previousName)
    .eq("sort_order", input.previousSortOrder);
  query = input.previousArchivedAt
    ? query.eq("archived_at", input.previousArchivedAt)
    : query.is("archived_at", null);
  const { data, error } = await query.select("id").maybeSingle();
  if (error)
    throw new Error(`update_grocery_category failed: ${error.message}`);
  if (!data)
    throw new Error(
      "This category changed. Reload the page before editing it again.",
    );
}
