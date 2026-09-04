import "server-only";
import { writeCalendar } from "@/domain/calendar/ical-write";
import { inputFromRow, type CalendarRow } from "./rows";
export function canonicalCalendar(row: CalendarRow): string {
  return (
    row.ical_data ??
    writeCalendar(inputFromRow(row), {
      uid: row.ical_uid,
      existing: row.ical_edit_base ?? row.last_synced_ical,
      cancelled: !!row.cancelled_at,
    })
  );
}
