import "server-only";

import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const routineSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  instructions: z.string().nullable(),
  paused_at: z.string().nullable(),
  archived_at: z.string().nullable(),
});
const occurrenceSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  due_date: z.string(),
  original_due_date: z.string(),
  status: z.enum(["open", "completed", "skipped"]),
  role: z.string().nullable(),
  planned_assignee_id: z.string().nullable(),
  routine: routineSchema,
});

export async function loadOccurrenceDetail(id: string) {
  if (!z.string().uuid().safeParse(id).success) notFound();
  const member = await requireMemberContext();
  const client = await createClient();
  const [occurrenceResult, completion, members] = await Promise.all([
    client
      .from("routine_occurrences")
      .select(
        "id, routine_id, due_date, original_due_date, status, role, planned_assignee_id, routine:routines!inner(id, title, instructions, paused_at, archived_at)",
      )
      .eq("household_id", member.householdId)
      .eq("id", id)
      .maybeSingle(),
    client
      .from("routine_completions")
      .select("note, photo_path, completed_by_member_id, completed_on")
      .eq("household_id", member.householdId)
      .eq("occurrence_id", id)
      .maybeSingle(),
    client
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId),
  ]);
  if (occurrenceResult.error || completion.error || members.error)
    throw new Error("Couldn't load this routine. Try again.");
  if (!occurrenceResult.data) notFound();
  const occurrence = occurrenceSchema.parse(occurrenceResult.data);
  const names = new Map(
    (members.data ?? []).map((person) => [person.user_id, person.display_name]),
  );
  const owner =
    occurrence.planned_assignee_id === null
      ? "Either of you"
      : occurrence.planned_assignee_id === member.userId
        ? "Your turn"
        : `${names.get(occurrence.planned_assignee_id) ?? "Your partner"}'s turn`;
  return {
    occurrence,
    owner,
    completion: completion.data,
    completedBy: completion.data
      ? (names.get(completion.data.completed_by_member_id) ?? "Your partner")
      : null,
    canAct:
      occurrence.status === "open" &&
      occurrence.role === "current" &&
      (!occurrence.routine.paused_at ||
        Boolean(occurrence.routine.archived_at)),
  };
}
