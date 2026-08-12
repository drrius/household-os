export const ZURICH_TIME_ZONE = "Europe/Zurich";

const zurichDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZURICH_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const zurichWeekdayFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: ZURICH_TIME_ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

const zurichTimestampFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZURICH_TIME_ZONE,
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

export function formatZurichTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new RangeError(`Invalid timestamp: ${timestamp}`);
  }

  const parts = Object.fromEntries(
    zurichTimestampFormatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return `${parts.day} ${parts.month} ${parts.year}, ${parts.hour}:${parts.minute}`;
}

export function zurichCivilDate(now = new Date()): string {
  return zurichDateFormatter.format(now);
}

export function formatZurichDayLabel(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new RangeError(`Invalid civil date: ${isoDate}`);
  }

  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  return zurichWeekdayFormatter.format(utcNoon);
}

export function addCivilDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new RangeError(`Invalid civil date: ${isoDate}`);
  }

  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  utcNoon.setUTCDate(utcNoon.getUTCDate() + days);
  return utcNoon.toISOString().slice(0, 10);
}

/** Monday of the Zurich week containing isoDate (ISO weekday Mon=1). */
export function startOfZurichWeek(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (
    year === undefined ||
    month === undefined ||
    day === undefined ||
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    Number.isNaN(day)
  ) {
    throw new RangeError(`Invalid civil date: ${isoDate}`);
  }

  const utcNoon = new Date(Date.UTC(year, month - 1, day, 12));
  const weekday = utcNoon.getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addCivilDays(isoDate, -daysFromMonday);
}
