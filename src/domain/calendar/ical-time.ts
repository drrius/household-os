import ICAL from "ical.js";
import { Temporal } from "@js-temporal/polyfill";
import { isTimeZone } from "./date-time";

class IanaTimezone extends ICAL.Timezone {
  constructor(tzid: string) {
    super({ tzid });
  }
  override utcOffset(time: ICAL.Time): number {
    const value = Temporal.ZonedDateTime.from(
      {
        timeZone: this.tzid,
        year: time.year,
        month: time.month,
        day: time.day,
        hour: time.hour,
        minute: time.minute,
        second: time.second,
      },
      { disambiguation: "compatible" },
    );
    return value.offsetNanoseconds / 1_000_000_000;
  }
}
export function attachIanaTimezones(calendar: ICAL.Component): void {
  for (const event of calendar.getAllSubcomponents("vevent")) {
    for (const property of event.getAllProperties()) {
      const zoneId = property.getParameter("tzid");
      if (typeof zoneId !== "string" || !isTimeZone(zoneId)) continue;
      for (const value of property.getValues()) {
        if (value instanceof ICAL.Time && value.zone.tzid === "floating")
          value.zone = new IanaTimezone(zoneId);
      }
    }
  }
}
export function icalTimeToIso(time: ICAL.Time, fallbackZone: string): string {
  if (time.isDate) return `${time.toString()}T00:00:00Z`;
  if (time.zone.tzid === "UTC") return time.toJSDate().toISOString();
  const zone = time.zone.tzid === "floating" ? fallbackZone : time.zone.tzid;
  if (isTimeZone(zone)) {
    const date = {
      timeZone: zone,
      year: time.year,
      month: time.month,
      day: time.day,
      hour: time.hour,
      minute: time.minute,
      second: time.second,
    };
    const earlier = Temporal.ZonedDateTime.from(date, {
      disambiguation: "earlier",
    });
    if (earlier.hour !== time.hour || earlier.minute !== time.minute)
      throw new Error("This occurrence falls in a skipped clock-change hour.");
    return earlier.toInstant().toString();
  }
  if (time.zone.component) return time.toJSDate().toISOString();
  throw new Error(`Unsupported calendar time zone: ${zone}`);
}
export function timeForInput(
  iso: string,
  timeZone: string,
  allDay: boolean,
): ICAL.Time {
  if (allDay) return ICAL.Time.fromDateString(iso.slice(0, 10));
  const zoned = Temporal.Instant.from(iso).toZonedDateTimeISO(timeZone);
  return ICAL.Time.fromData(
    {
      year: zoned.year,
      month: zoned.month,
      day: zoned.day,
      hour: zoned.hour,
      minute: zoned.minute,
      second: zoned.second,
    },
    timeZone === "UTC" ? ICAL.Timezone.utcTimezone : new IanaTimezone(timeZone),
  );
}
