import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Household command returned an unexpected payload");
}

export async function createArea(
  name: string,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data: rows, error: orderError } = await supabase
    .from("areas")
    .select("sort_order")
    .eq("household_id", member.householdId)
    .order("sort_order", { ascending: false })
    .limit(1);
  if (orderError) throw new Error(`area_order failed: ${orderError.message}`);
  const previousOrder = rows?.[0]?.sort_order;
  const { data, error } = await supabase
    .from("areas")
    .insert({
      household_id: member.householdId,
      name,
      sort_order: typeof previousOrder === "number" ? previousOrder + 10 : 0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`create_area failed: ${error.message}`);
  return asRecord(data);
}

export async function createPet(
  name: string,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .insert({ household_id: member.householdId, name })
    .select("id")
    .single();
  if (error) throw new Error(`create_pet failed: ${error.message}`);
  return asRecord(data);
}

export async function updateHouseholdName(name: string): Promise<void> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({ name })
    .eq("id", member.householdId);
  if (error) throw new Error(`update_household failed: ${error.message}`);
}

export async function updateArea(input: {
  id: string;
  name: string;
}): Promise<void> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("areas")
    .update({ name: input.name })
    .eq("household_id", member.householdId)
    .eq("id", input.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`update_area failed: ${error.message}`);
  if (!data)
    throw new Error("That area is no longer available. Refresh and try again.");
}

export async function updatePet(input: {
  id: string;
  name: string;
}): Promise<void> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("pets")
    .update({ name: input.name })
    .eq("household_id", member.householdId)
    .eq("id", input.id)
    .is("archived_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(`update_pet failed: ${error.message}`);
  if (!data)
    throw new Error("That pet is no longer available. Refresh and try again.");
}

export async function reorderAreas(ids: readonly string[]): Promise<void> {
  await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_household_areas", {
    p_area_ids: [...ids],
  });
  if (error) throw new Error(`reorder_areas failed: ${error.message}`);
}
