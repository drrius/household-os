import { ensureCalendarTimezones } from "./ical-timezones";
import ICAL from "ical.js";
import { isTimeZone } from "./date-time";
import { readCalendar } from "./ical-read";
import { occurrenceComponent } from "./ical-occurrence";
import { timeForInput } from "./ical-time";
import type { CalendarEventInput } from "./types";

function setTime(
  component: ICAL.Component,
  name: string,
  iso: string,
  input: CalendarEventInput,
) {
  component.removeAllProperties(name);
  const property = new ICAL.Property(name);
  property.setValue(timeForInput(iso, input.timeZone, input.allDay));
  if (!input.allDay && input.timeZone !== "UTC")
    property.setParameter("tzid", input.timeZone);
  component.addProperty(property);
}
function applyFields(
  component: ICAL.Component,
  input: CalendarEventInput,
  cancelled: boolean,
  isNew: boolean,
) {
  component.updatePropertyWithValue("summary", input.title);
  component.updatePropertyWithValue("location", input.location);
  component.updatePropertyWithValue("description", input.notes);
  markRevision(component, cancelled, isNew);
  component.removeAllProperties("duration");
  setTime(component, "dtstart", input.startsAt, input);
  setTime(component, "dtend", input.endsAt, input);
}
export function writeCalendar(
  input: CalendarEventInput,
  options: {
    uid: string;
    existing?: string | null;
    recurrenceId?: string | null;
    cancelled?: boolean;
    resetRecurrence?: boolean;
  },
): string {
  const parsed = options.existing ? readCalendar(options.existing) : null;
  if (parsed && parsed.event.uid !== options.uid)
    throw new Error("The calendar event identity does not match.");
  const calendar = parsed?.calendar ?? new ICAL.Component("vcalendar");
  if (!options.existing) {
    calendar.updatePropertyWithValue("version", "2.0");
    calendar.updatePropertyWithValue(
      "prodid",
      "-//Household OS//Shared calendar//EN",
    );
  }
  let master = calendar
    .getAllSubcomponents("vevent")
    .find((item) => !item.hasProperty("recurrence-id"));
  if (!master) {
    master = new ICAL.Component("vevent");
    master.updatePropertyWithValue("uid", options.uid);
    calendar.addSubcomponent(master);
  }
  ensureEditable(master);
  let target = master;
  if (options.recurrenceId) {
    if (!parsed)
      throw new Error("Choose an existing occurrence of this series.");
    target = occurrenceComponent(
      calendar,
      parsed.event,
      options.recurrenceId,
      options.cancelled ?? false,
    );
    ensureEditable(target);
  } else {
    const old = parsed?.event;
    const changesSchedule =
      old &&
      (old.startDate.isDate !== input.allDay ||
        (!input.allDay &&
          (old.component.getFirstProperty("dtstart")?.getParameter("tzid") ??
            (old.startDate.zone.tzid === "UTC" ? "UTC" : "Europe/Zurich")) !==
            input.timeZone) ||
        old.startDate.toString() !==
          timeForInput(
            input.startsAt,
            input.timeZone,
            input.allDay,
          ).toString() ||
        String(old.component.getFirstPropertyValue("rrule") ?? "") !==
          (input.recurrenceRule ?? ""));
    if (changesSchedule && calendar.getAllSubcomponents("vevent").length > 1)
      throw new Error(
        "This series has individually changed dates. Edit one occurrence here, or change the series schedule in Apple Calendar.",
      );
    if (options.resetRecurrence) {
      target.removeAllProperties("rdate");
      target.removeAllProperties("exdate");
    }
    target.removeAllProperties("rrule");
    if (input.recurrenceRule)
      target.updatePropertyWithValue(
        "rrule",
        ICAL.Recur.fromString(input.recurrenceRule),
      );
  }
  if (options.recurrenceId && options.cancelled)
    markRevision(target, true, false);
  else
    applyFields(target, input, options.cancelled ?? false, !options.existing);
  ensureCalendarTimezones(calendar);
  return calendar.toString();
}

function ensureEditable(master: ICAL.Component) {
  for (const field of ["dtstart", "dtend"]) {
    const zone = master.getFirstProperty(field)?.getParameter("tzid");
    if (typeof zone === "string" && !isTimeZone(zone))
      throw new Error(
        "This event uses a custom time zone. Edit it in Apple Calendar to preserve its original definition.",
      );
  }
  if (master.hasProperty("attendee") || master.hasProperty("organizer"))
    throw new Error(
      "This event has invitations. Manage its changes in Apple Calendar so guests receive the right updates.",
    );
  if (
    String(master.getFirstPropertyValue("summary") ?? "").length > 200 ||
    String(master.getFirstPropertyValue("description") ?? "").length > 8000 ||
    String(master.getFirstPropertyValue("location") ?? "").length > 500
  )
    throw new Error(
      "This event contains longer text than this editor supports. Edit it in Apple Calendar to keep all its details.",
    );
}

export function calendarEditingIssue(ical: string): string | null {
  try {
    for (const component of readCalendar(ical).calendar.getAllSubcomponents(
      "vevent",
    ))
      ensureEditable(component);
    return null;
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Edit this event in Apple Calendar.";
  }
}

function markRevision(
  component: ICAL.Component,
  cancelled: boolean,
  isNew: boolean,
) {
  if (cancelled) component.updatePropertyWithValue("status", "CANCELLED");
  else if (
    (isNew && !component.hasProperty("status")) ||
    component.getFirstPropertyValue("status") === "CANCELLED"
  )
    component.updatePropertyWithValue("status", "CONFIRMED");
  component.updatePropertyWithValue(
    "dtstamp",
    ICAL.Time.fromJSDate(new Date(), true),
  );
  component.updatePropertyWithValue(
    "sequence",
    Number(component.getFirstPropertyValue("sequence") ?? 0) + 1,
  );
}
