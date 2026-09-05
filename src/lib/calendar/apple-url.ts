import { CalendarError } from "./errors";

export function appleCalendarUrl(
  value: string,
  base = "https://caldav.icloud.com/",
): URL {
  let url: URL;
  try {
    url = new URL(value, base);
  } catch {
    throw new CalendarError(
      "invalid",
      "iCloud returned an invalid calendar address.",
    );
  }
  if (
    url.protocol !== "https:" ||
    url.port ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    !/^(caldav|p\d+-caldav)\.icloud\.com$/i.test(url.hostname)
  ) {
    throw new CalendarError(
      "invalid",
      "Only private Apple iCloud calendar addresses are supported.",
    );
  }
  if (/%2f|%5c|%2e/i.test(url.pathname) || url.pathname.includes("\\")) {
    throw new CalendarError(
      "invalid",
      "iCloud returned an unsafe calendar address.",
    );
  }
  return url;
}

export function calendarObjectUrl(value: string, calendarUrl: string): URL {
  const calendar = appleCalendarUrl(calendarUrl);
  const url = appleCalendarUrl(value, calendar.href);
  const prefix = calendar.pathname.endsWith("/")
    ? calendar.pathname
    : `${calendar.pathname}/`;
  if (
    url.origin !== calendar.origin ||
    !url.pathname.startsWith(prefix) ||
    url.pathname === prefix
  ) {
    throw new CalendarError(
      "invalid",
      "The event address does not belong to the selected calendar.",
    );
  }
  return url;
}
