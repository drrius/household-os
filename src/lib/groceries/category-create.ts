import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
export async function createGroceryCategory(
  name: string,
  sortOrder: number,
  creationId?: string,
) {
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const id = creationId ? z.uuid().parse(creationId) : undefined;
  const { error } = await db
    .from("grocery_categories")
    .insert({
      name,
      sort_order: sortOrder,
      household_id: householdId,
      ...(id ? { id } : {}),
    });
  if (error?.code === "23505" && id) {
    const existing = await db
      .from("grocery_categories")
      .select("name,sort_order,archived_at")
      .eq("household_id", householdId)
      .eq("id", id)
      .maybeSingle();
    if (
      !existing.error &&
      existing.data?.name === name &&
      existing.data.sort_order === sortOrder &&
      existing.data.archived_at === null
    )
      return;
  }
  if (error)
    throw new Error(
      "Could not save this grocery category. Read the categories before retrying.",
    );
}
