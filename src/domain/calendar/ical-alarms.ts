import ICAL from "ical.js";

export function validateAlarmTimes(event: ICAL.Component): void {
  for (const alarm of event.getAllSubcomponents("valarm")) {
    const triggers = alarm.getAllProperties("trigger");
    const trigger = triggers[0];
    const value = trigger?.getFirstValue();
    // RFC 5545 section 3.8.6.3: absolute alarms must be UTC, without RELATED.
    const absolute =
      value instanceof ICAL.Time &&
      !value.isDate &&
      value.zone.tzid === "UTC" &&
      !trigger?.getParameter("related");
    const related = trigger?.getParameter("related");
    const relative =
      value instanceof ICAL.Duration &&
      (related === undefined ||
        (typeof related === "string" &&
          ["START", "END"].includes(related.toUpperCase())));
    if (
      triggers.length !== 1 ||
      trigger?.getParameter("tzid") ||
      (!absolute && !relative)
    )
      throw new Error(
        "This event has an unsupported alarm time. Manage its reminders in Apple Calendar.",
      );
  }
}
