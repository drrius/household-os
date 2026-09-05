import { calendarEditView } from "@/lib/calendar/edit-view";
import type { CalendarRow } from "@/lib/calendar/rows";
import {
  isoToLocalDateTime,
  lastAllDayDate,
} from "@/domain/calendar/date-time";
import { masterFromIcal } from "@/domain/calendar/ical-read";

export function calendarDetails(row: CalendarRow, recurrenceId?: string) {
  const view = calendarEditView(row, recurrenceId);
  return {
    edit: view.issue
      ? { issue: view.issue }
      : editFields(view.input!, view.recurring!, Boolean(row.connection_id)),
    remoteConflict: remoteDetails(row),
  };
}
function editFields(
  input: NonNullable<ReturnType<typeof calendarEditView>["input"]>,
  recurring: boolean,
  publish: boolean,
) {
  return {
    fields: {
      title: input.title,
      start: input.allDay
        ? input.startsAt.slice(0, 10)
        : isoToLocalDateTime(input.startsAt, input.timeZone),
      end: input.allDay
        ? lastAllDayDate(input.endsAt)
        : isoToLocalDateTime(input.endsAt, input.timeZone),
      timeZone: input.timeZone,
      allDay: input.allDay,
      attendance: input.attendance,
      attendingMemberId: input.attendingMemberId,
      projectId: input.projectId,
      location: input.location,
      notes: input.notes,
      repeat: recurring ? "keep" : "none",
      until: "",
      publish,
    },
  };
}
function remoteDetails(row: CalendarRow) {
  if (row.sync_state !== "conflict") return null;
  if (!row.remote_conflict_ical) return { deleted: true };
  try {
    const value = masterFromIcal(row.remote_conflict_ical);
    return {
      title: value.title,
      startsAt: value.startsAt,
      endsAt: value.endsAt,
      timeZone: value.timeZone,
      allDay: value.allDay,
      location: value.location,
      notes: value.notes,
      recurrenceRule: value.recurrenceRule,
      cancelled: value.cancelled,
    };
  } catch {
    return {
      issue:
        "The Apple version cannot be read safely. Review this event in calendar settings.",
    };
  }
}
