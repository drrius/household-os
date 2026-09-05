import ICAL from "ical.js";
import { readCalendar } from "./ical-read";
import { validateRecurrences } from "./ical-occurrence";
import { calendarEditingIssue } from "./ical-write";
import { icalTimeToIso } from "./ical-time";

/** Stored ICS is untrusted, including snapshots written through authenticated RPCs. */
export function validateCalendarExport(ical: string, uid: string): void {
  const { calendar, event } = readCalendar(ical);
  if (event.uid !== uid)
    throw new Error(
      "The calendar event identity does not match. Refresh before syncing.",
    );
  if (
    calendar.hasProperty("method") ||
    calendar.getFirstPropertyValue("version") !== "2.0"
  )
    throw new Error(
      "Scheduling messages cannot be sent through household calendar sync.",
    );
  validateComponents(calendar);
  const issue = calendarEditingIssue(ical);
  if (issue) throw new Error(issue);
  const recurrenceIds = new Set<string>();
  for (const component of calendar.getAllSubcomponents("vevent")) {
    if (
      component.getAllProperties("uid").length !== 1 ||
      component.getFirstPropertyValue("uid") !== uid
    )
      throw new Error(
        "Every occurrence must belong to the same calendar event.",
      );
    if (
      component.getAllProperties("dtstart").length !== 1 ||
      component.getAllProperties("dtend").length > 1 ||
      component.getAllProperties("rrule").length > 1 ||
      (component.hasProperty("dtend") && component.hasProperty("duration"))
    )
      throw new Error("This calendar resource contains ambiguous event times.");
    const occurrence = new ICAL.Event(component);
    const zone = component.getFirstProperty("dtstart")?.getParameter("tzid");
    const fallback = typeof zone === "string" ? zone : "Europe/Zurich";
    const start = icalTimeToIso(occurrence.startDate, fallback);
    const end = icalTimeToIso(occurrence.endDate, fallback);
    if (
      !Number.isFinite(Date.parse(start)) ||
      !Number.isFinite(Date.parse(end)) ||
      Date.parse(end) < Date.parse(start) ||
      occurrence.startDate.isDate !== occurrence.endDate.isDate
    )
      throw new Error("This calendar resource contains invalid event times.");
    const recurrence = component.getFirstPropertyValue("recurrence-id");
    const identity =
      recurrence instanceof ICAL.Time
        ? recurrenceKey(recurrence, event.startDate)
        : null;
    if (
      component.getAllProperties("recurrence-id").length > 1 ||
      (identity && recurrenceIds.has(identity))
    )
      throw new Error("This calendar resource repeats an occurrence identity.");
    if (identity) recurrenceIds.add(identity);
    for (const child of component.getAllSubcomponents()) {
      if (
        child.name !== "valarm" ||
        !["DISPLAY", "AUDIO"].includes(
          String(child.getFirstPropertyValue("action")),
        ) ||
        child.hasProperty("attendee") ||
        child.getAllSubcomponents().length
      )
        throw new Error(
          "Manage this event's notification actions in Apple Calendar.",
        );
    }
  }
  validateRecurrences(event, [...recurrenceIds]);
}

function validateComponents(component: ICAL.Component): void {
  const children: Record<string, string[]> = {
    vcalendar: ["vevent", "vtimezone"],
    vevent: ["valarm"],
    vtimezone: ["standard", "daylight"],
    standard: [],
    daylight: [],
    valarm: [],
  };
  if (component.hasProperty("organizer") || component.hasProperty("attendee"))
    throw new Error("Manage invitation changes in Apple Calendar.");
  for (const child of component.getAllSubcomponents()) {
    if (!children[component.name]?.includes(child.name))
      throw new Error(
        "This calendar resource contains unsupported components.",
      );
    validateComponents(child);
  }
}

function recurrenceKey(time: ICAL.Time, masterStart: ICAL.Time): string {
  if (time.isDate) return time.toString();
  const fallback =
    masterStart.zone.tzid === "floating"
      ? "Europe/Zurich"
      : masterStart.zone.tzid;
  return ICAL.Time.fromJSDate(
    new Date(icalTimeToIso(time, fallback)),
    true,
  ).toString();
}
