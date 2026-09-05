import { notFound } from "next/navigation";
import { buildHouseholdAgenda } from "@/domain/today/agenda";
import { HouseholdAgenda } from "@/ui/today/household-agenda";
import { AppShell } from "@/ui/shell/app-shell";

export default async function AgendaFixture({
  searchParams,
}: {
  searchParams: Promise<{ completed?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { completed } = await searchParams;
  const today = "2026-09-05";
  const entries = fixtureEntries(completed);
  return (
    <AppShell>
      <h1 className="mb-4 font-heading text-3xl">Today</h1>
      <HouseholdAgenda
        model={{ today, entries, warnings: [], syncAttention: 0 }}
      />
    </AppShell>
  );
}

function fixtureEntries(completed?: string) {
  const projectId = "66000000-0000-4000-8000-000000000001";
  const eventId = "66000000-0000-4000-8000-000000000002";
  const today = "2026-09-05";
  return buildHouseholdAgenda({
    today,
    members: { anna: "Anna", dan: "Dan" },
    projects: [
      {
        id: projectId,
        title: "Japan together",
        kind: "trip",
        status: "active",
        archived_at: null,
        ends_on: null,
      },
    ],
    tasks: [
      {
        id: "66000000-0000-4000-8000-000000000003",
        title: "Pack passports",
        project_id: projectId,
        assigned_member_id: "anna",
        due_on: "2026-09-04",
        completed_at: completed ? today : null,
        archived_at: null,
      },
    ],
    bookings: [
      {
        id: "66000000-0000-4000-8000-000000000004",
        project_id: projectId,
        title: "Flight to Tokyo",
        status: "booked",
        starts_at: "2026-09-05T07:00:00Z",
        ends_at: "2026-09-05T19:00:00Z",
        calendar_event_id: eventId,
        archived_at: null,
      },
    ],
    events: [
      {
        id: eventId,
        title: "Flight to Tokyo",
        recurrenceId: "20260905T070000Z",
        startsAt: "2026-09-05T07:00:00Z",
        endsAt: "2026-09-05T19:00:00Z",
        allDay: false,
        timeZone: "Europe/Zurich",
        location: "ZRH",
        notes: "",
        isException: false,
        recurring: false,
        attendance: "both",
      },
    ],
    commitments: [
      {
        id: "66000000-0000-4000-8000-000000000005",
        title: "Home insurance",
        renewal_on: "2026-10-06",
        notice_days: 30,
        status: "active",
        archived_at: null,
        responsible_member_id: "dan",
      },
    ],
  });
}
