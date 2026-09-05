import ICAL from "ical.js";
import fc from "fast-check";
import { expect, it } from "vitest";
import { writeCalendar } from "./ical-write";
import type { CalendarEventInput } from "./types";
const input: CalendarEventInput = {
  title: "Shared plan",
  startsAt: "2026-03-28T09:00:00Z",
  endsAt: "2026-03-28T10:00:00Z",
  timeZone: "Europe/Zurich",
  allDay: false,
  location: "",
  notes: "",
  attendance: "both",
  attendingMemberId: null,
  projectId: null,
  recurrenceRule: "FREQ=DAILY;COUNT=3",
};
function independentRead(value: CalendarEventInput, existing?: string) {
  const ical = writeCalendar(value, { uid: "timezone@example", existing });
  const calendar = ICAL.Component.fromString(ical);
  return {
    ical,
    calendar,
    event: new ICAL.Event(calendar.getFirstSubcomponent("vevent")!),
  };
}
it.each([
  ["Europe/Zurich", "2026-03-28T09:00:00Z", "2026-03-29T08:00:00.000Z"],
  ["America/New_York", "2026-10-31T14:00:00Z", "2026-11-01T15:00:00.000Z"],
])(
  "embeds DST rules a separate reader can use for %s",
  (timeZone, startsAt, next) => {
    const { calendar, event } = independentRead({
      ...input,
      timeZone,
      startsAt,
      endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
    });
    expect(calendar.getAllSubcomponents("vtimezone")).toHaveLength(1);
    const iterator = event.iterator();
    iterator.next();
    expect(iterator.next()!.toJSDate().toISOString()).toBe(next);
  },
);
it("round-trips instants across named zones, aliases and fractional offsets without app timezone helpers", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 364 }),
      fc.constantFrom(
        "Europe/Zurich",
        "US/Eastern",
        "Asia/Kathmandu",
        "Australia/Lord_Howe",
      ),
      (day, timeZone) => {
        const startsAt = new Date(Date.UTC(2026, 0, 1 + day, 12)).toISOString();
        const value = {
          ...input,
          timeZone,
          startsAt,
          endsAt: new Date(Date.parse(startsAt) + 3600000).toISOString(),
          recurrenceRule: null,
        };
        const { calendar, event, ical } = independentRead(value);
        expect(event.startDate.toJSDate().toISOString()).toBe(startsAt);
        expect(
          calendar
            .getFirstSubcomponent("vtimezone")!
            .getFirstPropertyValue("tzid"),
        ).toBe(timeZone);
        const edited = independentRead({ ...value, title: "Renamed" }, ical);
        expect(edited.calendar.getAllSubcomponents("vtimezone")).toHaveLength(
          1,
        );
        expect(
          edited.calendar.getFirstSubcomponent("vtimezone")!.toString(),
        ).toBe(calendar.getFirstSubcomponent("vtimezone")!.toString());
      },
    ),
  );
});
it("does not add timezone components for UTC or civil all-day events", () => {
  expect(
    independentRead({ ...input, timeZone: "UTC" }).calendar.getAllSubcomponents(
      "vtimezone",
    ),
  ).toEqual([]);
  expect(
    independentRead({
      ...input,
      allDay: true,
      startsAt: "2026-03-28T00:00:00Z",
      endsAt: "2026-03-29T00:00:00Z",
    }).calendar.getAllSubcomponents("vtimezone"),
  ).toEqual([]);
});
