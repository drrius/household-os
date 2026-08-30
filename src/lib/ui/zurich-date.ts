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

const zurichDayFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZURICH_TIME_ZONE,
  day: "numeric",
});

const zurichMonthFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZURICH_TIME_ZONE,
  month: "short",
});

const zurichYearFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZURICH_TIME_ZONE,
  year: "numeric",
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

/** Noon keeps the instant inside the civil day under every Zurich offset. */
function civilDateAtUtcNoon(isoDate: string): Date {
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

  return new Date(Date.UTC(year, month - 1, day, 12));
}

export function formatZurichDayLabel(isoDate: string): string {
  return zurichWeekdayFormatter.format(civilDateAtUtcNoon(isoDate));
}

export function addCivilDays(isoDate: string, days: number): string {
  const utcNoon = civilDateAtUtcNoon(isoDate);
  utcNoon.setUTCDate(utcNoon.getUTCDate() + days);
  return utcNoon.toISOString().slice(0, 10);
}

/** Monday of the Zurich week containing isoDate (ISO weekday Mon=1). */
export function startOfZurichWeek(isoDate: string): string {
  const weekday = civilDateAtUtcNoon(isoDate).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addCivilDays(isoDate, -daysFromMonday);
}

/** Drops the parts both ends share: "24 – 30 Aug", "31 Aug – 6 Sep". */
export function formatCivilDateRangeLabel(
  startIsoDate: string,
  endIsoDate: string,
): string {
  const start = civilDateAtUtcNoon(startIsoDate);
  const end = civilDateAtUtcNoon(endIsoDate);
  const startDay = zurichDayFormatter.format(start);
  const endDay = zurichDayFormatter.format(end);
  const startMonth = zurichMonthFormatter.format(start);
  const endMonth = zurichMonthFormatter.format(end);
  const startYear = zurichYearFormatter.format(start);
  const endYear = zurichYearFormatter.format(end);

  if (startMonth === endMonth && startYear === endYear) {
    return `${startDay} – ${endDay} ${endMonth}`;
  }
  if (startYear === endYear) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}`;
  }
  return `${startDay} ${startMonth} ${startYear} – ${endDay} ${endMonth} ${endYear}`;
}
