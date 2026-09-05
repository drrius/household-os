import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadCalendarOccurrences } from "@/lib/calendar/agenda";
import { createClient } from "@/lib/supabase/server";
import { addCivilDays, zurichCivilDate } from "@/lib/ui/zurich-date";
import { buildHouseholdAgenda } from "@/domain/today/agenda";
import type {
  AgendaBooking,
  AgendaCommitment,
  AgendaProject,
  AgendaTask,
} from "@/domain/today/agenda-types";

type QueryPage = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;
async function readPages<T>(
  query: (from: number, to: number) => QueryPage,
): Promise<T[]> {
  const rows: T[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const result = await query(offset, offset + 499);
    if (result.error || !result.data)
      throw new Error("Couldn't load upcoming household plans. Try again.");
    rows.push(...(result.data as T[]));
    if (result.data.length < 500) return rows;
  }
  throw new Error(
    "There are too many household plans to show safely. Open their individual collections.",
  );
}

export async function loadHouseholdAgenda(today = zurichCivilDate()) {
  const member = await requireMemberContext();
  const db = await createClient();
  const horizon = addCivilDays(today, 6);
  const [projects, tasks, bookings, commitments, calendar, members] =
    await Promise.all([
      readPages<AgendaProject>((from, to) =>
        db
          .from("household_projects")
          .select("id,title,kind,status,archived_at,ends_on")
          .eq("household_id", member.householdId)
          .order("id")
          .range(from, to),
      ),
      readPages<AgendaTask>((from, to) =>
        db
          .from("project_tasks")
          .select(
            "id,project_id,title,due_on,assigned_member_id,archived_at,completed_at",
          )
          .eq("household_id", member.householdId)
          .is("archived_at", null)
          .is("completed_at", null)
          .lte("due_on", horizon)
          .order("id")
          .range(from, to),
      ),
      readPages<AgendaBooking>((from, to) =>
        db
          .from("trip_bookings")
          .select(
            "id,project_id,title,status,archived_at,starts_at,ends_at,calendar_event_id",
          )
          .eq("household_id", member.householdId)
          .is("archived_at", null)
          .neq("status", "cancelled")
          .order("id")
          .range(from, to),
      ),
      readPages<AgendaCommitment>((from, to) =>
        db
          .from("household_commitments")
          .select(
            "id,title,renewal_on,notice_days,status,archived_at,responsible_member_id",
          )
          .eq("household_id", member.householdId)
          .is("archived_at", null)
          .neq("status", "ended")
          .order("id")
          .range(from, to),
      ),
      loadCalendarOccurrences(today, addCivilDays(today, 7)),
      db
        .from("household_members")
        .select("user_id,display_name")
        .eq("household_id", member.householdId),
    ]);
  if (members.error)
    throw new Error("Couldn't load household responsibility. Try again.");
  return {
    today,
    entries: buildHouseholdAgenda({
      today,
      projects,
      tasks,
      bookings,
      commitments,
      events: calendar.items,
      members: Object.fromEntries(
        (members.data ?? []).map((person) => [
          person.user_id,
          person.display_name,
        ]),
      ),
    }),
    warnings: calendar.warnings.map(({ id, title }) => ({ id, title })),
    syncAttention: calendar.attention.length,
  };
}
export type HouseholdAgendaModel = Awaited<
  ReturnType<typeof loadHouseholdAgenda>
>;
