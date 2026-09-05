import { z } from "zod";
import { localDateTimeToIso } from "@/domain/calendar/date-time";
import { saveEventAction } from "@/lib/calendar/actions";
import { getCalendarOptions } from "@/lib/calendar/context";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { EventForm } from "@/ui/calendar/event-form";
import { FormPage } from "@/ui/forms/form-page";
export default async function NewEventPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const query = await searchParams;
  const date = z.iso.date().safeParse(query.date);
  const day = date.success ? date.data : zurichCivilDate();
  const options = await getCalendarOptions();
  return (
    <FormPage
      backHref="/plan/calendar"
      title="Make a plan"
      description="A shared place for appointments, adventures and time together."
    >
      <EventForm
        action={saveEventAction}
        options={{
          ...options,
          canPublish:
            !!options.connection?.selected_calendar_url &&
            !options.connection.read_only,
        }}
        input={{
          title: "",
          startsAt: localDateTimeToIso(`${day}T18:00`, "Europe/Zurich"),
          endsAt: localDateTimeToIso(`${day}T19:00`, "Europe/Zurich"),
          timeZone: "Europe/Zurich",
          allDay: false,
          attendance: "both",
          attendingMemberId: null,
          location: "",
          notes: "",
          projectId: null,
          recurrenceRule: null,
        }}
      />
    </FormPage>
  );
}
