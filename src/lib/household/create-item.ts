import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
export async function createHouseholdItem(
  table: "areas" | "pets",
  name: string,
  creationId?: string,
): Promise<{ id: string }> {
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const id = creationId ? z.uuid().parse(creationId) : undefined;
  const { data, error } = await db
    .from(table)
    .insert({ household_id: householdId, name, ...(id ? { id } : {}) })
    .select("id")
    .single();
  if (error?.code === "23505" && id) {
    const previous = await db
      .from(table)
      .select("id,name,archived_at")
      .eq("household_id", householdId)
      .eq("id", id)
      .maybeSingle();
    if (
      !previous.error &&
      previous.data?.name === name &&
      previous.data.archived_at === null
    )
      return { id };
  }
  if (error || !data)
    throw new Error(
      "Could not confirm this household item. Read the current settings before retrying.",
    );
  return z.object({ id: z.uuid() }).parse(data);
}
