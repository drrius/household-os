import { calendarEditingIssue } from "@/domain/calendar/ical-write";
import { isTimeZone } from "@/domain/calendar/date-time";
import { calendarOccurrence, readCalendar } from "@/domain/calendar/ical-read";
import { getCalendarEvent, getCalendarOptions } from "@/lib/calendar/context";
import { inputFromRow } from "@/lib/calendar/rows";
import { EventDetail } from "@/ui/calendar/event-detail";
export default async function CalendarEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ occurrence?: string }>;
}) {
  const [{ id }, { occurrence }] = await Promise.all([params, searchParams]);
  const [row, options] = await Promise.all([
    getCalendarEvent(id),
    getCalendarOptions(),
  ]);
  const connection = options.connection;
  const memberName =
    options.members.find((member) => member.user_id === row.attending_member_id)
      ?.display_name ?? null;
  let input = inputFromRow(row);
  let recurring = !!row.recurrence_rule;
  let issue = "";
  try {
    if (row.ical_data) {
      recurring = readCalendar(row.ical_data).event.isRecurring();
      issue = calendarEditingIssue(row.ical_data) ?? "";
      if (occurrence)
        input = { ...input, ...calendarOccurrence(row.ical_data, occurrence) };
    }
  } catch (error) {
    issue =
      error instanceof Error
        ? error.message
        : "Cannot display this occurrence.";
  }
  const editable =
    !(row.connection_id && connection?.read_only) &&
    row.sync_state !== "conflict" &&
    !issue &&
    isTimeZone(input.timeZone);
  const formatted = input.allDay
    ? `${input.startsAt.slice(0, 10)} · All day`
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "full",
        timeStyle: "short",
        timeZone: isTimeZone(input.timeZone) ? input.timeZone : "UTC",
      }).format(new Date(input.startsAt));
  return (
    <EventDetail
      {...{
        input,
        row,
        connection,
        issue,
        editable,
        formatted,
        recurring,
        occurrence,
        memberName,
      }}
    />
  );
}
