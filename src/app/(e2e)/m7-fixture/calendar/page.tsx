import type { AgendaModel } from "@/lib/calendar/agenda";
import { notFound, redirect } from "next/navigation";
import { parseCalendarForm } from "@/domain/calendar/forms";
import { calendarWeek } from "@/domain/calendar/date-time";
import { writeCalendar } from "@/domain/calendar/ical-write";
import { masterFromIcal } from "@/domain/calendar/ical-read";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { AppShell } from "@/ui/shell/app-shell";
import { FormPage } from "@/ui/forms/form-page";
import { EventForm } from "@/ui/calendar/event-form";
import { AgendaScreen } from "@/ui/calendar/agenda-screen";
import { ConnectionScreen } from "@/ui/calendar/connection-screen";
async function saveFixture(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  let title = "";
  const failure = await settleFormAction(previous, form, async () => {
    const input = parseCalendarForm(Object.fromEntries(form));
    title = masterFromIcal(
      writeCalendar(input, { uid: "fixture@household-os" }),
    ).title;
  });
  if (failure) return failure;
  redirect(`/m7-fixture/calendar?saved=${encodeURIComponent(title)}`);
}
const input = {
  title: "",
  startsAt: "2026-09-07T16:00:00Z",
  endsAt: "2026-09-07T17:00:00Z",
  timeZone: "Europe/Zurich",
  allDay: false,
  attendance: "both" as const,
  attendingMemberId: null,
  location: "",
  notes: "",
  projectId: null,
  recurrenceRule: null,
};
const agendaItems: AgendaModel["items"] = [
  {
    ...input,
    id: "00000000-0000-4000-8000-000000000001",
    title: "Dinner at our favourite place",
    startsAt: "2026-09-07T17:00:00Z",
    endsAt: "2026-09-07T19:00:00Z",
    recurrenceId: "2026-09-07T19:00:00",
    isException: false,
    syncState: "local",
    recurring: true,
  },
  {
    ...input,
    id: "00000000-0000-4000-8000-000000000002",
    title: "Sunday night train",
    startsAt: "2026-09-06T21:00:00Z",
    endsAt: "2026-09-06T22:00:00Z",
    recurrenceId: "2026-09-06T23:00:00",
    isException: false,
    syncState: "local",
    recurring: false,
  },
  {
    ...input,
    id: "00000000-0000-4000-8000-000000000003",
    title: "Monday night train",
    startsAt: "2026-09-07T21:00:00Z",
    endsAt: "2026-09-07T22:00:00Z",
    recurrenceId: "2026-09-07T23:00:00",
    isException: false,
    syncState: "local",
    recurring: false,
  },
];
export default async function CalendarFixture({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string; saved?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const query = await searchParams;
  return (
    <AppShell>
      {query.saved ? (
        <FormPage
          title="Plan saved"
          backHref="/m7-fixture/calendar"
          description={query.saved}
        >
          <p>Calendar data validated and round-tripped.</p>
        </FormPage>
      ) : query.surface === "agenda" ? (
        <AgendaScreen
          model={{
            week: calendarWeek("2026-09-07"),
            items: agendaItems,
            warnings: [],
            attention: [],
            connection: null,
          }}
        />
      ) : query.surface === "setup" ? (
        <ConnectionScreen connection={null} calendars={[]} configured={false} />
      ) : (
        <FormPage
          title="Make a plan"
          backHref="/m7-fixture/calendar?surface=agenda"
          description="Appointments, adventures and time together."
        >
          <EventForm
            action={saveFixture}
            input={
              query.surface === "initial-all-day"
                ? {
                    ...input,
                    allDay: true,
                    startsAt: "2026-09-07T00:00:00Z",
                    endsAt: "2026-09-08T00:00:00Z",
                  }
                : input
            }
            options={{
              members: [
                {
                  user_id: "00000000-0000-4000-8000-000000000001",
                  display_name: "Darius",
                },
                {
                  user_id: "00000000-0000-4000-8000-000000000002",
                  display_name: "Partner",
                },
              ],
              projects: [],
              canPublish: false,
            }}
          />
        </FormPage>
      )}
    </AppShell>
  );
}
