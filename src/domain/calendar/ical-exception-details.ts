import ICAL from "ical.js";
import { IanaTimezone } from "./ical-time";

export function seriesRecurrenceTime(
  time: ICAL.Time,
  zone: ICAL.Timezone,
): ICAL.Time {
  const value = time.clone();
  if (value.isDate) return value;
  const target =
    zone.tzid === "floating" ? new IanaTimezone("Europe/Zurich") : zone;
  if (value.zone.tzid === "floating") value.zone = target;
  return value.convertToZone(target);
}
function identity(time: ICAL.Time, zone: ICAL.Timezone): string {
  const value = seriesRecurrenceTime(time, zone);
  return value.isDate
    ? value.toString()
    : value.convertToZone(ICAL.Timezone.utcTimezone).toString();
}
export function pointException(calendar: ICAL.Component, time: ICAL.Time) {
  const key = identity(time, time.zone);
  return calendar.getAllSubcomponents("vevent").find((component) => {
    const recurrence = component.getFirstPropertyValue("recurrence-id");
    return (
      recurrence instanceof ICAL.Time &&
      recurrence.isDate === time.isDate &&
      identity(recurrence, time.zone) === key
    );
  });
}
export function createOccurrenceResolver(event: ICAL.Event) {
  const zone = event.startDate.zone;
  const points = new Map<string, ICAL.Event>();
  const ranges: { time: ICAL.Time; event: ICAL.Event }[] = [];
  for (const component of event.component.parent?.getAllSubcomponents(
    "vevent",
  ) ?? []) {
    const recurrence = component.getFirstPropertyValue("recurrence-id");
    if (!(recurrence instanceof ICAL.Time)) continue;
    const key = identity(recurrence, zone);
    if (points.has(key))
      throw new Error("This calendar resource repeats an occurrence identity.");
    const exception = new ICAL.Event(component);
    points.set(key, exception);
    if (exception.modifiesFuture())
      ranges.push({
        time: seriesRecurrenceTime(recurrence, zone),
        event: exception,
      });
  }
  ranges.sort((a, b) => a.time.compare(b.time));
  return (time: ICAL.Time): ReturnType<ICAL.Event["getOccurrenceDetails"]> => {
    const point = points.get(identity(time, zone));
    if (point)
      return {
        recurrenceId: time,
        startDate: point.startDate,
        endDate: point.endDate,
        item: point,
      };
    const current = seriesRecurrenceTime(time, zone);
    let low = 0,
      high = ranges.length;
    while (low < high) {
      const middle = Math.floor((low + high) / 2);
      if (ranges[middle]!.time.compare(current) <= 0) low = middle + 1;
      else high = middle;
    }
    const range = ranges[low - 1];
    if (range) {
      const original = seriesRecurrenceTime(
        range.time,
        range.event.startDate.zone,
      );
      const shift = range.event.startDate.subtractDate(original);
      const startDate = seriesRecurrenceTime(time, range.event.startDate.zone);
      startDate.addDuration(shift);
      const endDate = startDate.clone();
      endDate.addDuration(range.event.duration);
      return { recurrenceId: time, startDate, endDate, item: range.event };
    }
    const endDate = time.clone();
    endDate.addDuration(event.duration);
    return { recurrenceId: time, startDate: time, endDate, item: event };
  };
}
