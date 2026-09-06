import { Temporal } from "@js-temporal/polyfill";
import { occursOnDay } from "@/domain/calendar/interval";
import {
  attendanceDetail,
  bookingDetail,
  commitmentDeadline,
  responsibleLabel,
  zurichDay,
  zurichTime,
} from "@/domain/today/agenda-labels";
import { routineRows } from "./week-routines";
import type {
  HouseholdWeekDay,
  HouseholdWeekInput,
  WeekPlanEntry,
  WeekProject,
} from "./week-types";

type DayPlacement = {
  /** True when the item occurs on the day. */
  covers: (day: string) => boolean;
  /** The first day the item occurs on, in Zurich. */
  firstDay: string;
  time: string | null;
  entry: Omit<WeekPlanEntry, "time" | "continues">;
};

export function weekDates(weekStart: string): string[] {
  const start = Temporal.PlainDate.from(weekStart);
  return Array.from({ length: 7 }, (_, offset) =>
    start.add({ days: offset }).toString(),
  );
}

export function buildHouseholdWeek(
  input: HouseholdWeekInput,
): HouseholdWeekDay[] {
  const dates = weekDates(input.weekStart);
  const projects = new Map(
    input.projects
      .filter(
        (p) =>
          !p.archived_at && p.status !== "complete" && p.status !== "cancelled",
      )
      .map((p) => [p.id, p]),
  );
  const represented = new Set<string>();
  const placements = [
    ...eventPlacements(input, projects, represented),
    ...bookingPlacements(input, projects, represented),
    ...tripPlacements(projects),
  ];
  const dated = datedEntries(input, projects);
  const routines = routineRows(input, dates);
  return dates.map((date) => ({
    date,
    plans: [
      ...placements
        .filter((placement) => placement.covers(date))
        .map((placement) => ({
          ...placement.entry,
          continues: placement.firstDay < date,
          time: placement.firstDay < date ? null : placement.time,
        })),
      ...(dated.get(date) ?? []),
    ].sort(
      (a, b) =>
        (a.time ?? "").localeCompare(b.time ?? "") || a.id.localeCompare(b.id),
    ),
    routines: routines.get(date) ?? [],
  }));
}

/** Calendar occurrences, with a linked booking standing in for its event. */
function eventPlacements(
  input: HouseholdWeekInput,
  projects: ReadonlyMap<string, WeekProject>,
  represented: Set<string>,
): DayPlacement[] {
  const placements: DayPlacement[] = [];
  for (const event of input.events) {
    const firstDay = event.allDay
      ? event.startsAt.slice(0, 10)
      : zurichDay(event.startsAt);
    const time = event.allDay ? null : zurichTime(event.startsAt);
    const href = `/plan/calendar/${event.id}${event.recurring ? `?occurrence=${encodeURIComponent(event.recurrenceId)}` : ""}`;
    const covers = (day: string) => occursOnDay(event, day);
    const linked = input.bookings.filter(
      (booking) =>
        booking.calendar_event_id === event.id &&
        projects.has(booking.project_id) &&
        !booking.archived_at &&
        booking.status !== "cancelled" &&
        booking.starts_at &&
        !event.allDay &&
        Temporal.Instant.compare(booking.starts_at, event.startsAt) === 0 &&
        Temporal.Instant.compare(
          booking.ends_at ?? booking.starts_at,
          event.endsAt,
        ) === 0,
    );
    for (const booking of linked) {
      represented.add(booking.id);
      placements.push({
        covers,
        firstDay,
        time,
        entry: {
          id: `booking:${booking.id}:${event.recurrenceId}`,
          kind: "booking",
          title: booking.title,
          detail: bookingDetail(
            projects.get(booking.project_id)!.title,
            booking.status,
          ),
          href: `/plan/projects/${booking.project_id}/bookings/${booking.id}`,
          related: { href, label: "Calendar event" },
        },
      });
    }
    if (linked.length === 0)
      placements.push({
        covers,
        firstDay,
        time,
        entry: {
          id: `calendar:${event.id}:${event.recurrenceId}`,
          kind: "calendar",
          title: event.title,
          detail: attendanceDetail(event),
          href,
        },
      });
  }
  return placements;
}

/** Bookings that no calendar occurrence already represents. */
function bookingPlacements(
  input: HouseholdWeekInput,
  projects: ReadonlyMap<string, WeekProject>,
  represented: ReadonlySet<string>,
): DayPlacement[] {
  const placements: DayPlacement[] = [];
  for (const booking of input.bookings) {
    const project = projects.get(booking.project_id);
    if (
      !project ||
      booking.archived_at ||
      booking.status === "cancelled" ||
      !booking.starts_at ||
      represented.has(booking.id)
    )
      continue;
    const interval = {
      startsAt: booking.starts_at,
      endsAt: booking.ends_at ?? booking.starts_at,
      allDay: false,
    };
    placements.push({
      covers: (day) => occursOnDay(interval, day),
      firstDay: zurichDay(booking.starts_at),
      time: zurichTime(booking.starts_at),
      entry: {
        id: `booking:${booking.id}`,
        kind: "booking",
        title: booking.title,
        detail: bookingDetail(project.title, booking.status),
        href: `/plan/projects/${project.id}/bookings/${booking.id}`,
      },
    });
  }
  return placements;
}

function tripPlacements(
  projects: ReadonlyMap<string, WeekProject>,
): DayPlacement[] {
  const placements: DayPlacement[] = [];
  for (const project of projects.values()) {
    if (project.kind !== "trip" || !project.starts_on) continue;
    const start = project.starts_on;
    const end = project.ends_on ?? project.starts_on;
    placements.push({
      covers: (day) => start <= day && day <= end,
      firstDay: start,
      time: null,
      entry: {
        id: `trip:${project.id}`,
        kind: "trip",
        title: project.title,
        detail: project.destination || "Away",
        href: `/plan/projects/${project.id}`,
      },
    });
  }
  return placements;
}

function datedEntries(
  input: HouseholdWeekInput,
  projects: ReadonlyMap<string, WeekProject>,
): ReadonlyMap<string, WeekPlanEntry[]> {
  const byDay = new Map<string, WeekPlanEntry[]>();
  const add = (day: string, entry: WeekPlanEntry) => {
    const entries = byDay.get(day) ?? [];
    entries.push(entry);
    byDay.set(day, entries);
  };
  for (const task of input.tasks) {
    const project = projects.get(task.project_id);
    if (!project || task.archived_at || task.completed_at || !task.due_on)
      continue;
    add(task.due_on, {
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      time: null,
      continues: false,
      detail: `${project.title} · ${responsibleLabel(input.members, task.assigned_member_id)}`,
      href: `/plan/projects/${project.id}/tasks/${task.id}`,
    });
  }
  for (const project of projects.values()) {
    if (!project.ends_on) continue;
    // A trip span already shows its final day.
    if (project.kind === "trip" && project.starts_on) continue;
    add(project.ends_on, {
      id: `project:${project.id}`,
      kind: "project",
      title: project.title,
      time: null,
      continues: false,
      detail: project.kind === "trip" ? "Trip ends" : "Project target date",
      href: `/plan/projects/${project.id}`,
    });
  }
  for (const commitment of input.commitments) {
    const deadline = commitmentDeadline(commitment, input.members);
    if (!deadline) continue;
    add(deadline.day, {
      id: `commitment:${commitment.id}`,
      kind: "commitment",
      title: commitment.title,
      time: null,
      continues: false,
      detail: deadline.detail,
      href: `/home/commitments/${commitment.id}`,
    });
  }
  return byDay;
}
