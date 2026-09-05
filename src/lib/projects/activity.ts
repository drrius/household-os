import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  PROJECT_ACTIVITY_KINDS,
  type ProjectActivityPayload,
} from "@/domain/projects/activity";

export type ProjectActivityEntry = {
  id: string;
  actor_member_id: string;
  created_at: string;
  payload: ProjectActivityPayload;
};
export async function loadProjectActivity(projectId: string, page: number) {
  const member = await requireMemberContext();
  if (
    !z.uuid().safeParse(projectId).success ||
    !Number.isSafeInteger(page) ||
    page < 0 ||
    page > 999999
  )
    throw new Error("Choose a valid project history page.");
  const client = await createClient();
  const { data, error } = await client
    .from("activity_events")
    .select("id, actor_member_id, created_at, payload")
    .eq("household_id", member.householdId)
    .in("kind", [...PROJECT_ACTIVITY_KINDS])
    .eq("payload->>project_id", projectId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(page * 10, page * 10 + 10);
  if (error) throw new Error("Couldn't load this plan's history. Try again.");
  const rows = data as ProjectActivityEntry[];
  return { entries: rows.slice(0, 10), hasMore: rows.length > 10 };
}
