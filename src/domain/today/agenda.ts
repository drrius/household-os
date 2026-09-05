import { Temporal } from "@js-temporal/polyfill";
import { occursOnDay, overlapsInterval } from "@/domain/calendar/interval";
import { noticeDeadline } from "@/domain/home-records/dates";
import type {
  AgendaProject,
  HouseholdAgendaEntry,
  HouseholdAgendaInput,
} from "./agenda-types";

const zone = "Europe/Zurich";
const localDay = (instant: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();
const localTime = (instant: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });

type ActiveProjects = ReadonlyMap<string, AgendaProject>;

export function buildHouseholdAgenda(
  input: HouseholdAgendaInput,
): HouseholdAgendaEntry[] {
  const horizon = Temporal.PlainDate.from(input.today)
    .add({ days: 6 })
    .toString();
  const projects = new Map(
    input.projects
      .filter(
        (p) =>
          !p.archived_at && p.status !== "complete" && p.status !== "cancelled",
      )
      .map((p) => [p.id, p]),
  );
  const calendar = calendarEntries(input, projects, horizon);
  return [
    ...deadlineEntries(input, projects, horizon),
    ...calendar.entries,
    ...bookingEntries(input, projects, horizon, calendar.representedBookings),
  ].sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      (a.time ?? "").localeCompare(b.time ?? "") ||
      a.id.localeCompare(b.id),
  );
}

function deadlineEntries(
  input: HouseholdAgendaInput,
  projects: ActiveProjects,
  horizon: string,
): HouseholdAgendaEntry[] {
  const { today, members } = input;
  const entries: HouseholdAgendaEntry[] = [];
  const responsible = (id: string | null) =>
    id ? (members[id] ?? "Assigned member") : "Together";
  for (const task of input.tasks) {
    const project = projects.get(task.project_id);
    if (
      !project ||
      task.archived_at ||
      task.completed_at ||
      !task.due_on ||
      task.due_on > horizon
    )
      continue;
    entries.push({
      id: `task:${task.id}`,
      kind: "task",
      title: task.title,
      day: task.due_on,
      time: null,
      ongoing: false,
      detail: `${project.title} · ${responsible(task.assigned_member_id)}`,
      href: `/plan/projects/${project.id}/tasks/${task.id}`,
    });
  }
  for (const project of projects.values()) {
    if (!project.ends_on || project.ends_on > horizon) continue;
    // A trip end is a date in the itinerary, not perpetually overdue work.
    if (project.kind === "trip" && project.ends_on < today) continue;
    entries.push({
      id: `project:${project.id}`,
      kind: "project",
      title: project.title,
      day: project.ends_on,
      time: null,
      ongoing: false,
      detail: project.kind === "trip" ? "Trip ends" : "Project target date",
      href: `/plan/projects/${project.id}`,
    });
  }
  for (const commitment of input.commitments) {
    if (
      commitment.archived_at ||
      commitment.status === "ended" ||
      !commitment.renewal_on
    )
      continue;
    const needsNotice =
      commitment.status === "active" && commitment.notice_days > 0;
    const day = needsNotice
      ? noticeDeadline(commitment.renewal_on, commitment.notice_days)
      : commitment.renewal_on;
    if (day > horizon) continue;
    entries.push({
      id: `commitment:${commitment.id}`,
      kind: "commitment",
      title: commitment.title,
      day,
      time: null,
      ongoing: false,
      detail: `${needsNotice ? "Cancellation notice due" : commitment.status === "cancel_requested" ? "Check cancellation before renewal" : "Renewal due"} · ${responsible(commitment.responsible_member_id)}`,
      href: `/home/commitments/${commitment.id}`,
    });
  }
  return entries;
}

function calendarEntries(
  input: HouseholdAgendaInput,
  projects: ActiveProjects,
  horizon: string,
) {
  const { today } = input;
  const entries: HouseholdAgendaEntry[] = [];
  const visibleEvents = input.events.filter((event) => {
    const first = event.allDay
      ? event.startsAt.slice(0, 10)
      : localDay(event.startsAt);
    return first <= horizon && (first >= today || occursOnDay(event, today));
  });
  const representedBookings = new Set<string>();
  for (const event of visibleEvents) {
    const day = event.allDay
      ? event.startsAt.slice(0, 10)
      : localDay(event.startsAt);
    const href = `/plan/calendar/${event.id}${event.recurring ? `?occurrence=${encodeURIComponent(event.recurrenceId)}` : ""}`;
    const linked = input.bookings.filter(
      (booking) =>
        booking.calendar_event_id === event.id &&
        projects.has(booking.project_id) &&
        !booking.archived_at &&
        booking.status !== "cancelled" &&
        booking.starts_at &&
        overlapsInterval(
          booking.starts_at,
          booking.ends_at ?? booking.starts_at,
          event.startsAt,
          event.endsAt,
        ),
    );
    // Never guess equivalence from titles; only explicit links coalesce entries.
    for (const booking of linked) representedBookings.add(booking.id);
    const common = {
      title: event.title,
      day: day < today ? today : day,
      time: event.allDay || day < today ? null : localTime(event.startsAt),
      ongoing: day < today,
    };
    if (linked.length) {
      for (const booking of linked)
        entries.push({
          ...common,
          id: `booking:${booking.id}:${event.recurrenceId}`,
          kind: "booking",
          title: booking.title,
          detail: `${projects.get(booking.project_id)!.title} · ${booking.status === "idea" ? "Tentative booking" : "Booked"}`,
          href: `/plan/projects/${booking.project_id}/bookings/${booking.id}`,
          related: { href, label: "Calendar event" },
        });
    } else
      entries.push({
        ...common,
        id: `calendar:${event.id}:${event.recurrenceId}`,
        kind: "calendar",
        href,
        detail:
          event.attendance === "both"
            ? "Together"
            : event.attendance === "one"
              ? (event.attendeeName ?? "One of us")
              : "For awareness",
      });
  }
  return { entries, representedBookings };
}

function bookingEntries(
  input: HouseholdAgendaInput,
  projects: ActiveProjects,
  horizon: string,
  representedBookings: ReadonlySet<string>,
): HouseholdAgendaEntry[] {
  const { today } = input;
  const entries: HouseholdAgendaEntry[] = [];
  for (const booking of input.bookings) {
    const project = projects.get(booking.project_id);
    if (
      !project ||
      booking.archived_at ||
      booking.status === "cancelled" ||
      !booking.starts_at ||
      representedBookings.has(booking.id)
    )
      continue;
    const day = localDay(booking.starts_at);
    const ongoing =
      day < today &&
      occursOnDay(
        {
          startsAt: booking.starts_at,
          endsAt: booking.ends_at ?? booking.starts_at,
          allDay: false,
        },
        today,
      );
    if (day > horizon || (day < today && !ongoing)) continue;
    entries.push({
      id: `booking:${booking.id}`,
      kind: "booking",
      title: booking.title,
      day: ongoing ? today : day,
      time: ongoing ? null : localTime(booking.starts_at),
      ongoing,
      detail: `${project.title} · ${booking.status === "idea" ? "Tentative booking" : "Booked"}`,
      href: `/plan/projects/${project.id}/bookings/${booking.id}`,
    });
  }
  return entries;
}
