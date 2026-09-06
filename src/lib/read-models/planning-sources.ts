import "server-only";
import type {
  AgendaBooking,
  AgendaCommitment,
  AgendaTask,
} from "@/domain/today/agenda-types";
import type { WeekProject } from "@/domain/plan/week-types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type QueryPage = PromiseLike<{
  data: unknown[] | null;
  error: { message: string } | null;
}>;

export async function readPages<T>(
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

export type TaskDueWindow = { from?: string; to: string };

/**
 * Projects, open tasks, live bookings, commitments and member names that both
 * Today's agenda and the Plan week place onto days. Tasks are bounded by due
 * date; the other collections are small and filtered in the domain.
 */
export async function loadPlanningSources(tasksDue: TaskDueWindow) {
  const member = await requireMemberContext();
  const db = await createClient();
  const [projects, tasks, bookings, commitments, members] = await Promise.all([
    readPages<WeekProject>((from, to) =>
      db
        .from("household_projects")
        .select(
          "id,title,kind,status,archived_at,starts_on,ends_on,destination",
        )
        .eq("household_id", member.householdId)
        .order("id")
        .range(from, to),
    ),
    readPages<AgendaTask>((from, to) => {
      let query = db
        .from("project_tasks")
        .select(
          "id,project_id,title,due_on,assigned_member_id,archived_at,completed_at",
        )
        .eq("household_id", member.householdId)
        .is("archived_at", null)
        .is("completed_at", null)
        .lte("due_on", tasksDue.to);
      if (tasksDue.from) query = query.gte("due_on", tasksDue.from);
      return query.order("id").range(from, to);
    }),
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
    db
      .from("household_members")
      .select("user_id,display_name")
      .eq("household_id", member.householdId),
  ]);
  if (members.error)
    throw new Error("Couldn't load household responsibility. Try again.");
  return {
    member,
    db,
    projects,
    tasks,
    bookings,
    commitments,
    members: Object.fromEntries(
      (members.data ?? []).map((person) => [
        person.user_id,
        person.display_name,
      ]),
    ) as Record<string, string>,
  };
}
