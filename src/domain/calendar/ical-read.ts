import ICAL from "ical.js";
import { attachIanaTimezones, icalTimeToIso } from "./ical-time";
import type { CalendarMaster, CalendarOccurrence } from "./types";

export function readCalendar(ical: string): {
  calendar: ICAL.Component;
  event: ICAL.Event;
} {
  if (ical.length > 512 * 1024)
    throw new Error("This calendar event is too large to open.");
  let calendar: ICAL.Component;
  try {
    calendar = ICAL.Component.fromString(ical);
  } catch {
    throw new Error("This event contains invalid calendar data.");
  }
  if (calendar.name !== "vcalendar")
    throw new Error("Expected a calendar event.");
  attachIanaTimezones(calendar);
  const components = calendar.getAllSubcomponents("vevent");
  const masters = components.filter(
    (component) => !component.hasProperty("recurrence-id"),
  );
  if (masters.length !== 1 || components.length > 1000)
    throw new Error(
      "This calendar resource cannot be edited safely as one series.",
    );
  const event = new ICAL.Event(masters[0], { strictExceptions: true });
  if (!event.uid || !event.startDate)
    throw new Error(
      "This calendar event is missing its identity or start time.",
    );
  return { calendar, event };
}
function eventTimeZone(event: ICAL.Event, fallback = "Europe/Zurich"): string {
  const zone = event.component
    .getFirstProperty("dtstart")
    ?.getParameter("tzid");
  return typeof zone === "string"
    ? zone
    : event.startDate.zone.tzid === "UTC"
      ? "UTC"
      : fallback;
}
export function masterFromIcal(ical: string): CalendarMaster {
  const { event } = readCalendar(ical);
  const zone = eventTimeZone(event);
  return {
    uid: event.uid,
    title: (event.summary || "Untitled event").slice(0, 200),
    startsAt: icalTimeToIso(event.startDate, zone),
    endsAt: icalTimeToIso(event.endDate, zone),
    timeZone: zone,
    allDay: event.startDate.isDate,
    attendance: "both",
    attendingMemberId: null,
    location: (event.location || "").slice(0, 500),
    notes: (event.description || "").slice(0, 8000),
    projectId: null,
    recurrenceRule:
      event.component.getFirstPropertyValue("rrule")?.toString() ?? null,
    cancelled: event.component.getFirstPropertyValue("status") === "CANCELLED",
  };
}
function occurrenceDetails(
  event: ICAL.Event,
  time: ICAL.Time,
  zone: string,
): CalendarOccurrence | null {
  const details = event.getOccurrenceDetails(time);
  const occurrence = details.item;
  if (occurrence.component.getFirstPropertyValue("status") === "CANCELLED")
    return null;
  try {
    return {
      recurrenceId: time.toString(),
      title: occurrence.summary || "Untitled event",
      startsAt: icalTimeToIso(
        details.startDate,
        eventTimeZone(occurrence, zone),
      ),
      endsAt: icalTimeToIso(details.endDate, eventTimeZone(occurrence, zone)),
      timeZone: eventTimeZone(occurrence, zone),
      allDay: details.startDate.isDate,
      location: occurrence.location || "",
      notes: occurrence.description || "",
      isException: occurrence.isRecurrenceException(),
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("skipped clock-change")
    )
      return null;
    throw error;
  }
}
export function expandCalendar(
  ical: string,
  window: { start: string; end: string },
): CalendarOccurrence[] {
  const { event, calendar } = readCalendar(ical);
  if (event.component.getFirstPropertyValue("status") === "CANCELLED")
    return [];
  const zone = eventTimeZone(event);
  const start = Date.parse(window.start),
    end = Date.parse(window.end);
  const nominalEnd = end - minimumFutureShift(calendar, zone);
  const found: CalendarOccurrence[] = [];
  const iterator = event.iterator();
  let complete = false;
  for (let count = 0; count < 50000; count++) {
    const time = iterator.next();
    if (!time) {
      complete = true;
      break;
    }
    const occurrence = occurrenceDetails(event, time, zone);
    if (
      occurrence &&
      Date.parse(occurrence.startsAt) < end &&
      Date.parse(occurrence.endsAt) >= start
    )
      found.push(occurrence);
    if (found.length > 1000)
      throw new Error(
        "Too many repeating events to show this week. Open this series in Apple Calendar.",
      );
    try {
      if (
        Date.parse(icalTimeToIso(time, zone)) >= nominalEnd &&
        (!occurrence || Date.parse(occurrence.startsAt) >= end)
      ) {
        complete = true;
        break;
      }
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !error.message.includes("skipped clock-change")
      )
        throw error;
    }
  }
  if (!complete)
    throw new Error(
      "This recurrence is too frequent or too old to expand safely. Open it in Apple Calendar.",
    );
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const recurrence = component.getFirstPropertyValue("recurrence-id");
    if (!(recurrence instanceof ICAL.Time)) continue;
    const occurrence = occurrenceDetails(event, recurrence, zone);
    if (
      occurrence &&
      Date.parse(occurrence.startsAt) < end &&
      Date.parse(occurrence.endsAt) >= start &&
      !found.some((item) => item.recurrenceId === occurrence.recurrenceId)
    )
      found.push(occurrence);
  }
  return found.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function calendarOccurrence(
  ical: string,
  recurrenceId: string,
): CalendarOccurrence {
  const { event } = readCalendar(ical);
  const time = ICAL.Time.fromString(recurrenceId, undefined);
  const occurrence = occurrenceDetails(event, time, eventTimeZone(event));
  if (!occurrence) throw new Error("This occurrence was cancelled.");
  return occurrence;
}

function minimumFutureShift(calendar: ICAL.Component, zone: string): number {
  let shift = 0;
  for (const component of calendar.getAllSubcomponents("vevent")) {
    const property = component.getFirstProperty("recurrence-id");
    if (property?.getParameter("range") !== "THISANDFUTURE") continue;
    const original = property.getFirstValue();
    const moved = component.getFirstPropertyValue("dtstart");
    if (original instanceof ICAL.Time && moved instanceof ICAL.Time)
      shift = Math.min(
        shift,
        Date.parse(icalTimeToIso(moved, zone)) -
          Date.parse(icalTimeToIso(original, zone)),
      );
  }
  return shift;
}
