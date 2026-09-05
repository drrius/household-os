import { calendarEditingIssue } from "@/domain/calendar/ical-write";
import { readCalendar } from "@/domain/calendar/ical-read";
import { isTimeZone } from "@/domain/calendar/date-time";
import { calendarOccurrence } from "@/domain/calendar/ical-read";
import { saveEventAction } from "@/lib/calendar/actions";
import { getCalendarEvent, getCalendarOptions } from "@/lib/calendar/context";
import { calendarInputForDisplay } from "@/lib/calendar/rows";
import { EventForm } from "@/ui/calendar/event-form";
import { FormPage } from "@/ui/forms/form-page";
export default async function EditCalendarEventPage({
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
  const issue = row.ical_data ? calendarEditingIssue(row.ical_data) : null;
  if (issue)
    return (
      <FormPage
        backHref={`/plan/calendar/${id}`}
        title="Edit in Apple Calendar"
        description={issue}
      >
        <p>Your event is kept in the shared agenda.</p>
      </FormPage>
    );
  const input = calendarInputForDisplay(row);
  const edited =
    occurrence && row.ical_data
      ? { ...input, ...calendarOccurrence(row.ical_data, occurrence) }
      : input;
  if (!isTimeZone(edited.timeZone))
    return (
      <FormPage
        backHref={`/plan/calendar/${id}`}
        title="Edit in Apple Calendar"
        description="This event uses a custom time zone."
      >
        <p>
          Manage its changes in Apple Calendar to preserve the original
          time-zone definition.
        </p>
      </FormPage>
    );
  return (
    <FormPage
      backHref={`/plan/calendar/${id}`}
      title={occurrence ? "Edit this occurrence" : "Edit event"}
      description={
        occurrence
          ? "Change this date without moving the rest of the series. Attendance and project apply to the whole series."
          : "Connected events will be sent to iCloud the next time you sync."
      }
    >
      <EventForm
        action={saveEventAction}
        id={row.id}
        version={row.updated_at}
        recurrenceId={occurrence}
        recurring={
          row.ical_data
            ? readCalendar(row.ical_data).event.isRecurring()
            : false
        }
        input={edited}
        options={{
          ...options,
          canPublish:
            !row.connection_id &&
            !!options.connection?.selected_calendar_url &&
            !options.connection.read_only,
        }}
      />
    </FormPage>
  );
}
