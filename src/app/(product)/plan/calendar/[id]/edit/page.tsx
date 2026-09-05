import { notFound } from "next/navigation";
import { z } from "zod";
import { calendarEditView } from "@/lib/calendar/edit-view";
import { saveEventAction } from "@/lib/calendar/actions";
import { getCalendarEvent, getCalendarOptions } from "@/lib/calendar/context";
import { EventForm } from "@/ui/calendar/event-form";
import { FormPage } from "@/ui/forms/form-page";
export default async function EditCalendarEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ occurrence?: string | string[] }>;
}) {
  const [{ id }, { occurrence }] = await Promise.all([params, searchParams]);
  if (!z.uuid().safeParse(id).success) notFound();
  const [row, options] = await Promise.all([
    getCalendarEvent(id),
    getCalendarOptions(),
  ]);
  const view = calendarEditView(row, occurrence);
  if (view.issue !== null)
    return (
      <FormPage
        backHref={`/plan/calendar/${id}`}
        title="This event can't be edited here"
        description={view.issue}
      >
        <p>
          Return to the event to choose another date, or manage it in Apple
          Calendar.
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
        recurrenceId={typeof occurrence === "string" ? occurrence : undefined}
        recurring={view.recurring}
        input={view.input}
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
