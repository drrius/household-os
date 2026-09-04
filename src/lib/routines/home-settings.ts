import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function loadHomeSettingsOptions() {
  const member = await requireMemberContext();
  const client = await createClient();
  const [areas, pets] = await Promise.all([
    client
      .from("areas")
      .select("id, name, sort_order")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
    client
      .from("pets")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("name"),
  ]);
  if (areas.error || pets.error)
    throw new Error("Couldn't load your home settings.");
  return { areas: areas.data ?? [], pets: pets.data ?? [] };
}
