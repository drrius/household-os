import { isTimeZone } from "@/domain/calendar/date-time";
import { calendarOccurrence, readCalendar } from "@/domain/calendar/ical-read";
import { calendarEditingIssue } from "@/domain/calendar/ical-write";
import type { CalendarEventInput } from "@/domain/calendar/types";
import { calendarInputForDisplay, type CalendarRow } from "./rows";

type EditView =
  | { issue: string; input?: never; recurring?: never }
  | { issue: null; input: CalendarEventInput; recurring: boolean };
export function calendarEditView(
  row: CalendarRow,
  occurrence: string | string[] | undefined,
): EditView {
  try {
    if (Array.isArray(occurrence) || occurrence === "")
      throw new Error(
        "This saved occurrence link is invalid. Open the event to choose a date again.",
      );
    const issue = row.ical_data ? calendarEditingIssue(row.ical_data) : null;
    if (issue) return { issue };
    const input = calendarInputForDisplay(row);
    if (occurrence) {
      if (!row.ical_data)
        throw new Error(
          "This occurrence is no longer available. Open the event to choose a date again.",
        );
      Object.assign(input, calendarOccurrence(row.ical_data, occurrence));
    }
    if (!isTimeZone(input.timeZone))
      return {
        issue:
          "This event uses a custom time zone. Manage changes in Apple Calendar to preserve its definition.",
      };
    return {
      issue: null,
      input,
      recurring: row.ical_data
        ? readCalendar(row.ical_data).event.isRecurring()
        : false,
    };
  } catch (error) {
    return {
      issue:
        error instanceof Error
          ? error.message
          : "This occurrence could not be read. Open the event to choose a date again.",
    };
  }
}
