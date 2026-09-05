import { isTimeZone, lastAllDayDate } from "./date-time";
export function calendarTimePresentation(event: {
  startsAt: string;
  endsAt: string;
  timeZone: string;
  allDay: boolean;
}) {
  const displayTimeZone = isTimeZone(event.timeZone) ? event.timeZone : "UTC";
  if (event.allDay) {
    const first = event.startsAt.slice(0, 10),
      last = lastAllDayDate(event.endsAt);
    const date = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "full",
      timeZone: "UTC",
    });
    const days =
      first === last
        ? date.format(new Date(first))
        : `${date.format(new Date(first))} – ${date.format(new Date(last))}`;
    return { displayTimeZone, formatted: `${days} · All day` };
  }
  const full = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: displayTimeZone,
  });
  const day = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: displayTimeZone,
  });
  const start = new Date(event.startsAt),
    end = new Date(event.endsAt);
  const endLabel =
    day.format(start) === day.format(end)
      ? new Intl.DateTimeFormat("en-GB", {
          timeStyle: "short",
          timeZone: displayTimeZone,
        }).format(end)
      : full.format(end);
  return { displayTimeZone, formatted: `${full.format(start)} – ${endLabel}` };
}
