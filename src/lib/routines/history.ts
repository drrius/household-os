import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function loadRoutineHistory(routineId: string, page: number) {
  if (!z.string().uuid().safeParse(routineId).success) notFound();
  const member = await requireMemberContext();
  const client = await createClient();
  const [routine, occurrences] = await Promise.all([
    client
      .from("routines")
      .select("id, title, archived_at")
      .eq("household_id", member.householdId)
      .eq("id", routineId)
      .maybeSingle(),
    client
      .from("routine_occurrences")
      .select("id, due_date, status")
      .eq("household_id", member.householdId)
      .eq("routine_id", routineId)
      .in("status", ["completed", "skipped"])
      .order("closed_at", { ascending: false })
      .order("id")
      .range(page * 30, page * 30 + 30),
  ]);
  if (routine.error || occurrences.error)
    throw new Error("Couldn't load this routine's history.");
  if (!routine.data) notFound();
  return {
    routine: routine.data,
    occurrences: (occurrences.data ?? []).slice(0, 30),
    hasMore: (occurrences.data?.length ?? 0) > 30,
  };
}
