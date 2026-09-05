import "server-only";
import { createHouseholdItem } from "./create-item";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function createArea(
  name: string,
  creationId?: string,
): Promise<Record<string, unknown>> {
  return createHouseholdItem("areas", name, creationId);
}
export async function createPet(
  name: string,
  creationId?: string,
): Promise<Record<string, unknown>> {
  return createHouseholdItem("pets", name, creationId);
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
