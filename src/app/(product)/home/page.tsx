import { Suspense } from "react";
import { AttachmentUsageDisplay } from "@/ui/attachments/usage";
import { AttachmentUsageContent } from "@/ui/attachments/usage.server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireMemberContext } from "@/lib/auth/member-context";
import {
  buildHomeViewModel,
  parseHomeReadRows,
  type HomeReadRows,
} from "@/lib/read-models/home";
import { createClient } from "@/lib/supabase/server";
import { HomeScreen } from "@/ui/home/home-screen";

async function queryHomeRows(
  client: SupabaseClient,
  householdId: string,
): Promise<HomeReadRows> {
  const [households, members, pets, areas, routines, activityEvents] =
    await Promise.all([
      client.from("households").select("id, name").eq("id", householdId),
      client
        .from("household_members")
        .select("user_id, display_name, joined_at")
        .eq("household_id", householdId)
        .order("joined_at")
        .order("user_id"),
      client
        .from("pets")
        .select("id, name")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("name")
        .order("id"),
      client
        .from("areas")
        .select("id, name, sort_order")
        .eq("household_id", householdId)
        .is("archived_at", null)
        .order("sort_order")
        .order("name"),
      client
        .from("routines")
        .select("id, title, area_id, pet_id, archived_at")
        .eq("household_id", householdId),
      client
        .from("activity_events")
        .select(
          "id, actor_member_id, kind, entity_type, entity_id, payload, created_at",
        )
        .eq("household_id", householdId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
  const failures: Array<readonly [string, { message: string } | null]> = [
    ["household", households.error],
    ["members", members.error],
    ["pets", pets.error],
    ["areas", areas.error],
    ["routines", routines.error],
    ["activity", activityEvents.error],
  ];

  for (const [label, error] of failures) {
    if (error !== null) {
      throw new Error(`Home ${label} query failed: ${error.message}`);
    }
  }

  return parseHomeReadRows({
    households: households.data,
    members: members.data,
    pets: pets.data,
    areas: areas.data,
    routines: routines.data,
    activityEvents: activityEvents.data,
  });
}

export default async function HomePage() {
  const member = await requireMemberContext();
  const client = await createClient();
  const rows = await queryHomeRows(client, member.householdId);
  const model = buildHomeViewModel({
    viewerId: member.userId,
    ...rows,
  });

  return (
    <HomeScreen
      model={model}
      storageUsage={
        <Suspense
          fallback={<AttachmentUsageDisplay usage={{ status: "loading" }} />}
        >
          <AttachmentUsageContent client={client} />
        </Suspense>
      }
    />
  );
}
