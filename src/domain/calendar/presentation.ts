import { isTimeZone } from "./date-time";
export function calendarTimePresentation(event: {
  startsAt: string;
  timeZone: string;
  allDay: boolean;
}) {
  const displayTimeZone = isTimeZone(event.timeZone) ? event.timeZone : "UTC";
  return {
    displayTimeZone,
    formatted: event.allDay
      ? `${event.startsAt.slice(0, 10)} · All day`
      : new Intl.DateTimeFormat("en-GB", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: displayTimeZone,
        }).format(new Date(event.startsAt)),
  };
}
