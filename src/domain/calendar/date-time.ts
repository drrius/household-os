import { Temporal } from "@js-temporal/polyfill";

export function isTimeZone(timeZone: string): boolean {
  if (timeZone.startsWith("+") || timeZone.startsWith("-")) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone });
    Temporal.Now.instant().toZonedDateTimeISO(timeZone);
    return true;
  } catch {
    return false;
  }
}
export function localDateTimeToIso(local: string, timeZone: string): string {
  try {
    return Temporal.PlainDateTime.from(local)
      .toZonedDateTime(timeZone, { disambiguation: "reject" })
      .toInstant()
      .toString();
  } catch {
    throw new Error(
      "Choose a valid local time and time zone. Times skipped or repeated when clocks change need a different time.",
    );
  }
}
export function isoToLocalDateTime(iso: string, timeZone: string): string {
  return Temporal.Instant.from(iso)
    .toZonedDateTimeISO(timeZone)
    .toPlainDateTime()
    .toString({ smallestUnit: "minute" });
}
export function calendarWeek(date: string): {
  start: string;
  end: string;
  previous: string;
  next: string;
  days: string[];
} {
  const day = Temporal.PlainDate.from(date);
  const start = day.subtract({ days: day.dayOfWeek - 1 });
  return {
    start: start.toString(),
    end: start.add({ days: 7 }).toString(),
    previous: start.subtract({ days: 7 }).toString(),
    next: start.add({ days: 7 }).toString(),
    days: Array.from({ length: 7 }, (_, index) =>
      start.add({ days: index }).toString(),
    ),
  };
}
export function allDayBounds(
  start: string,
  lastDay: string,
): { startsAt: string; endsAt: string } {
  const first = Temporal.PlainDate.from(start);
  const end = Temporal.PlainDate.from(lastDay).add({ days: 1 });
  if (Temporal.PlainDate.compare(end, first) <= 0)
    throw new Error("The end date cannot be before the start date.");
  return { startsAt: `${first}T00:00:00Z`, endsAt: `${end}T00:00:00Z` };
}
export function lastAllDayDate(exclusiveEnd: string): string {
  return Temporal.PlainDate.from(exclusiveEnd.slice(0, 10))
    .subtract({ days: 1 })
    .toString();
}
