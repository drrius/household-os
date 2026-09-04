import "server-only";
import { calendarWeek } from "@/domain/calendar/date-time";
import { expandCalendar, readCalendar } from "@/domain/calendar/ical-read";
import { canonicalCalendar } from "./canonical";
import type { CalendarOccurrence } from "@/domain/calendar/types";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { calendarContext, getConnectionSummary } from "./context";
import { type CalendarRow } from "./rows";
export type AgendaItem = CalendarOccurrence & {
  id: string;
  attendance: string;
  syncState: string;
  projectId: string | null;
  recurring: boolean;
  attendeeName?: string | null;
};
export async function loadAgenda(requested?: string) {
  let week;
  try {
    week = calendarWeek(requested ?? zurichCivilDate());
  } catch {
    week = calendarWeek(zurichCivilDate());
  }
  const [rows, connection, members] = await Promise.all([
    readAgendaRows(),
    getConnectionSummary(),
    calendarMemberNames(),
  ]);
  const items: AgendaItem[] = [];
  const warnings: { id: string; title: string; message: string }[] = [];
  const attention: CalendarRow[] = [];
  const range = {
    start: `${week.start}T00:00:00Z`,
    end: `${week.end}T00:00:00Z`,
  };
  // Extend timed expansion around UTC boundaries; day grouping below uses Zurich.
  const window = {
    start: new Date(Date.parse(range.start) - 86400000).toISOString(),
    end: new Date(Date.parse(range.end) + 86400000).toISOString(),
  };
  for (const row of rows) {
    if (
      row.sync_state === "conflict" ||
      row.sync_state === "pending" ||
      row.last_sync_error
    )
      attention.push(row);
    if (row.cancelled_at) continue;
    try {
      const ical = canonicalCalendar(row);
      for (const occurrence of expandCalendar(ical, window))
        items.push({
          ...occurrence,
          id: row.id,
          attendance: row.attendance,
          attendeeName: row.attending_member_id
            ? members.get(row.attending_member_id)
            : null,
          syncState: row.sync_state,
          projectId: row.project_id,
          recurring: readCalendar(ical).event.isRecurring(),
        });
    } catch (error) {
      warnings.push({
        id: row.id,
        title: row.title,
        message:
          error instanceof Error
            ? error.message
            : "Could not display this event.",
      });
    }
  }
  return {
    week,
    items: items.sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
    warnings,
    attention: attention.map((row) => ({
      id: row.id,
      title: row.title,
      state: row.sync_state,
      error: row.last_sync_error,
    })),
    connection,
    cancelled: rows
      .filter((row) => row.cancelled_at)
      .sort((a, b) => b.cancelled_at!.localeCompare(a.cancelled_at!))
      .slice(0, 20)
      .map((row) => ({ id: row.id, title: row.title })),
  };
}
export type AgendaModel = Omit<
  Awaited<ReturnType<typeof loadAgenda>>,
  "cancelled"
> & { cancelled?: { id: string; title: string }[] };

async function readAgendaRows(): Promise<CalendarRow[]> {
  const { db, member } = await calendarContext();
  const rows: CalendarRow[] = [];
  for (let offset = 0; offset < 10000; offset += 500) {
    const result = await db
      .from("calendar_events")
      .select("*")
      .eq("household_id", member.householdId)
      .order("id")
      .range(offset, offset + 499);
    if (result.error) throw new Error("Could not load the shared calendar.");
    rows.push(...(result.data as CalendarRow[]));
    if (result.data.length < 500) return rows;
  }
  throw new Error(
    "This calendar is too large to display safely. Open it in Apple Calendar.",
  );
}

async function calendarMemberNames() {
  const { db, member } = await calendarContext();
  const result = await db
    .from("household_members")
    .select("user_id,display_name")
    .eq("household_id", member.householdId);
  if (result.error) throw new Error("Could not load calendar attendees.");
  return new Map<string, string>(
    (result.data ?? []).map((person) => [person.user_id, person.display_name]),
  );
}
