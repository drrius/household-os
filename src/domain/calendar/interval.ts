import { Temporal } from "@js-temporal/polyfill";

export function overlapsInterval(
  startsAt: string,
  endsAt: string,
  start: string,
  end: string,
): boolean {
  const eventStart = Date.parse(startsAt),
    eventEnd = Date.parse(endsAt);
  const windowStart = Date.parse(start),
    windowEnd = Date.parse(end);
  return (
    eventStart < windowEnd &&
    (eventEnd > windowStart ||
      (eventEnd === eventStart && eventStart >= windowStart))
  );
}
export function occursOnDay(
  event: { startsAt: string; endsAt: string; allDay: boolean },
  day: string,
  timeZone = "Europe/Zurich",
): boolean {
  if (event.allDay)
    return (
      event.startsAt.slice(0, 10) <= day && event.endsAt.slice(0, 10) > day
    );
  const start = Temporal.PlainDate.from(day).toZonedDateTime(timeZone);
  return overlapsInterval(
    event.startsAt,
    event.endsAt,
    start.toInstant().toString(),
    start.add({ days: 1 }).toInstant().toString(),
  );
}
