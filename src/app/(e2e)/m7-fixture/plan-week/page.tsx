import { notFound } from "next/navigation";
import { buildHouseholdWeek } from "@/domain/plan/week";
import type { HouseholdWeekInput } from "@/domain/plan/week-types";
import { buildPlanViewModel } from "@/lib/read-models/plan";
import { PlanScreen } from "@/ui/plan/plan-screen";
import { AppShell } from "@/ui/shell/app-shell";

const today = "2026-09-09";
const weekStart = "2026-09-07";
const tripId = "77000000-0000-4000-8000-000000000001";
const eventId = "77000000-0000-4000-8000-000000000002";

const fixtureInput: HouseholdWeekInput = {
  weekStart,
  today,
  viewerUserId: "anna",
  members: { anna: "Anna", dan: "Dan" },
  projects: [
    {
      id: tripId,
      title: "Japan together",
      kind: "trip",
      status: "active",
      archived_at: null,
      starts_on: "2026-09-08",
      ends_on: "2026-09-10",
      destination: "Tokyo",
    },
  ],
  tasks: [
    {
      id: "77000000-0000-4000-8000-000000000003",
      project_id: tripId,
      title: "Pack passports",
      due_on: "2026-09-07",
      assigned_member_id: "dan",
      archived_at: null,
      completed_at: null,
    },
  ],
  bookings: [
    {
      id: "77000000-0000-4000-8000-000000000004",
      project_id: tripId,
      title: "Flight to Tokyo",
      status: "booked",
      starts_at: "2026-09-08T07:00:00Z",
      ends_at: "2026-09-08T19:00:00Z",
      calendar_event_id: eventId,
      archived_at: null,
    },
  ],
  commitments: [],
  events: [
    {
      id: eventId,
      title: "Flight to Tokyo",
      recurrenceId: "20260908T070000Z",
      startsAt: "2026-09-08T07:00:00Z",
      endsAt: "2026-09-08T19:00:00Z",
      allDay: false,
      timeZone: "Europe/Zurich",
      location: "ZRH",
      notes: "",
      isException: false,
      recurring: false,
      attendance: "both",
    },
    {
      id: "77000000-0000-4000-8000-000000000005",
      title: "Dentist",
      recurrenceId: "20260911T063000Z",
      startsAt: "2026-09-11T06:30:00Z",
      endsAt: "2026-09-11T07:15:00Z",
      allDay: false,
      timeZone: "Europe/Zurich",
      location: "",
      notes: "",
      isException: false,
      recurring: false,
      attendance: "one",
      attendeeName: "Dan",
    },
  ],
  occurrences: [
    {
      id: "77000000-0000-4000-8000-000000000006",
      due_date: "2026-09-07",
      planned_assignee_id: null,
      meal_plan_entry_id: null,
      routine: { title: "Take out recycling", priority: "cleaning" },
    },
    {
      id: "77000000-0000-4000-8000-000000000007",
      due_date: today,
      planned_assignee_id: "anna",
      meal_plan_entry_id: null,
      routine: { title: "Feed the cat", priority: "pet_care" },
    },
    {
      id: "77000000-0000-4000-8000-000000000008",
      due_date: "2026-09-11",
      planned_assignee_id: "dan",
      meal_plan_entry_id: null,
      routine: { title: "Water the balcony", priority: "general" },
    },
  ],
  completions: [
    {
      completed_on: today,
      completed_at: "2026-09-09T05:20:00Z",
      completed_by_member_id: "dan",
      occurrence: {
        id: "77000000-0000-4000-8000-000000000009",
        due_date: today,
        planned_assignee_id: "dan",
        meal_plan_entry_id: null,
        routine: { title: "Empty dishwasher", priority: "cleaning" },
      },
    },
  ],
};

export default async function PlanWeekFixture({
  searchParams,
}: {
  searchParams: Promise<{ unavailable?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { unavailable } = await searchParams;
  const plan = buildPlanViewModel({
    weekStartParam: weekStart,
    today,
    entries: [
      {
        id: "77000000-0000-4000-8000-000000000010",
        date: today,
        slot: "dinner",
        title_snapshot: "Rösti with fried eggs",
        notes: null,
        leftover_of_entry_id: null,
      },
    ],
    library: [{ id: "77000000-0000-4000-8000-000000000011", name: "Rösti" }],
    prep: [],
    week: unavailable
      ? null
      : {
          days: buildHouseholdWeek(fixtureInput),
          warnings: [],
          syncAttention: 0,
        },
  });
  return (
    <AppShell>
      <PlanScreen plan={plan} />
    </AppShell>
  );
}
