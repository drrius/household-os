import { describe, expect, it } from "vitest";
import type {
  AgendaBooking,
  AgendaCalendarEvent,
} from "@/domain/today/agenda-types";
import { buildHouseholdWeek, weekDates } from "./week";
import type { HouseholdWeekInput, WeekProject } from "./week-types";

const weekStart = "2026-09-07";
const today = "2026-09-09";

const trip: WeekProject = {
  id: "trip",
  title: "Japan together",
  kind: "trip",
  status: "active",
  archived_at: null,
  starts_on: "2026-09-08",
  ends_on: "2026-09-10",
  destination: "Tokyo",
};

function event(
  overrides: Partial<AgendaCalendarEvent> = {},
): AgendaCalendarEvent {
  return {
    id: "event",
    recurrenceId: "20260908T070000Z",
    title: "Flight",
    startsAt: "2026-09-08T07:00:00Z",
    endsAt: "2026-09-08T09:00:00Z",
    allDay: false,
    timeZone: "Europe/Zurich",
    location: "",
    notes: "",
    isException: false,
    recurring: false,
    attendance: "both",
    ...overrides,
  };
}

function input(
  overrides: Partial<HouseholdWeekInput> = {},
): HouseholdWeekInput {
  return {
    weekStart,
    today,
    viewerUserId: "viewer",
    members: { viewer: "Anna", partner: "Dan" },
    projects: [],
    tasks: [],
    bookings: [],
    commitments: [],
    events: [],
    occurrences: [],
    completions: [],
    ...overrides,
  };
}

const plansOn = (week: ReturnType<typeof buildHouseholdWeek>, date: string) =>
  week.find((day) => day.date === date)!.plans;

describe("plans", () => {
  it("lists seven days from the week start", () => {
    expect(weekDates(weekStart)).toEqual([
      "2026-09-07",
      "2026-09-08",
      "2026-09-09",
      "2026-09-10",
      "2026-09-11",
      "2026-09-12",
      "2026-09-13",
    ]);
    expect(buildHouseholdWeek(input()).map((day) => day.date)).toEqual(
      weekDates(weekStart),
    );
  });

  it("places a timed event on its Zurich day with a time only on its first day", () => {
    // 22:30Z is 00:30 the next day in Zurich during summer time.
    const week = buildHouseholdWeek(
      input({
        events: [
          event({
            startsAt: "2026-09-07T22:30:00Z",
            endsAt: "2026-09-08T23:30:00Z",
          }),
        ],
      }),
    );
    expect(plansOn(week, "2026-09-07")).toEqual([]);
    expect(plansOn(week, "2026-09-08")).toMatchObject([
      { kind: "calendar", title: "Flight", time: "00:30", continues: false },
    ]);
    expect(plansOn(week, "2026-09-09")).toMatchObject([
      { kind: "calendar", time: null, continues: true, detail: "Together" },
    ]);
  });

  it("shows an all-day event on each civil day it covers and not on its exclusive end", () => {
    const week = buildHouseholdWeek(
      input({
        events: [
          event({
            allDay: true,
            startsAt: "2026-09-11",
            endsAt: "2026-09-13",
            attendance: "one",
            attendeeName: "Dan",
          }),
        ],
      }),
    );
    expect(plansOn(week, "2026-09-11")).toMatchObject([
      { time: null, continues: false, detail: "Dan" },
    ]);
    expect(plansOn(week, "2026-09-12")).toMatchObject([{ continues: true }]);
    expect(plansOn(week, "2026-09-13")).toEqual([]);
  });

  it("replaces a calendar event with its linked booking only for the same timed interval", () => {
    const linked: AgendaBooking = {
      id: "flight",
      project_id: "trip",
      title: "Flight to Tokyo",
      status: "booked",
      starts_at: "2026-09-08T07:00:00Z",
      ends_at: "2026-09-08T09:00:00Z",
      calendar_event_id: "event",
      archived_at: null,
    };
    const shifted: AgendaBooking = {
      ...linked,
      id: "train",
      title: "Train to airport",
      starts_at: "2026-09-08T05:00:00Z",
      ends_at: "2026-09-08T06:00:00Z",
    };
    const week = buildHouseholdWeek(
      input({
        projects: [trip],
        bookings: [linked, shifted],
        events: [event()],
      }),
    );
    const day = plansOn(week, "2026-09-08");
    expect(day.filter((entry) => entry.kind === "calendar")).toEqual([]);
    expect(day.filter((entry) => entry.kind === "booking")).toMatchObject([
      { title: "Train to airport", time: "07:00" },
      {
        title: "Flight to Tokyo",
        time: "09:00",
        detail: "Japan together · Booked",
        related: { href: "/plan/calendar/event", label: "Calendar event" },
      },
    ]);
  });

  it("spans a trip across its days without a separate end marker", () => {
    const week = buildHouseholdWeek(input({ projects: [trip] }));
    expect(plansOn(week, "2026-09-07")).toEqual([]);
    expect(plansOn(week, "2026-09-08")).toMatchObject([
      { kind: "trip", detail: "Tokyo", continues: false },
    ]);
    expect(plansOn(week, "2026-09-09")).toMatchObject([{ continues: true }]);
    expect(plansOn(week, "2026-09-10")).toMatchObject([
      { kind: "trip", continues: true },
    ]);
    expect(plansOn(week, "2026-09-11")).toEqual([]);
  });

  it("marks a trip end and a project target date when there is no span", () => {
    const week = buildHouseholdWeek(
      input({
        projects: [
          { ...trip, starts_on: null },
          {
            id: "kitchen",
            title: "Kitchen",
            kind: "project",
            status: "planning",
            archived_at: null,
            starts_on: null,
            ends_on: "2026-09-12",
            destination: "",
          },
          {
            id: "old",
            title: "Old",
            kind: "project",
            status: "complete",
            archived_at: null,
            starts_on: null,
            ends_on: "2026-09-12",
            destination: "",
          },
        ],
      }),
    );
    expect(plansOn(week, "2026-09-10")).toMatchObject([
      { kind: "project", detail: "Trip ends" },
    ]);
    expect(plansOn(week, "2026-09-12")).toMatchObject([
      { kind: "project", title: "Kitchen", detail: "Project target date" },
    ]);
  });

  it("places open task due dates and commitment deadlines on their day", () => {
    const week = buildHouseholdWeek(
      input({
        projects: [trip],
        tasks: [
          {
            id: "pack",
            project_id: "trip",
            title: "Pack passports",
            due_on: "2026-09-07",
            assigned_member_id: "partner",
            archived_at: null,
            completed_at: null,
          },
          {
            id: "done",
            project_id: "trip",
            title: "Book seats",
            due_on: "2026-09-07",
            assigned_member_id: null,
            archived_at: null,
            completed_at: "2026-09-01T10:00:00Z",
          },
        ],
        commitments: [
          {
            id: "insurance",
            title: "Home insurance",
            renewal_on: "2026-10-13",
            notice_days: 30,
            status: "active",
            archived_at: null,
            responsible_member_id: "viewer",
          },
        ],
      }),
    );
    expect(plansOn(week, "2026-09-07")).toMatchObject([
      { kind: "task", title: "Pack passports", detail: "Japan together · Dan" },
    ]);
    expect(plansOn(week, "2026-09-13")).toMatchObject([
      { kind: "commitment", detail: "Cancellation notice due · Anna" },
    ]);
  });

  it("orders each day by continuing items, then start time, then identity", () => {
    const week = buildHouseholdWeek(
      input({
        projects: [trip],
        events: [
          event({
            id: "late",
            startsAt: "2026-09-09T16:00:00Z",
            endsAt: "2026-09-09T17:00:00Z",
          }),
          event({
            id: "early",
            startsAt: "2026-09-09T06:00:00Z",
            endsAt: "2026-09-09T07:00:00Z",
          }),
        ],
      }),
    );
    expect(plansOn(week, "2026-09-09").map((entry) => entry.id)).toEqual([
      "trip:trip",
      "calendar:early:20260908T070000Z",
      "calendar:late:20260908T070000Z",
    ]);
  });
});
