import { expect, it } from "vitest";
import fc from "fast-check";
import { calendarOccurrence, expandCalendar, readCalendar } from "./ical-read";
import { writeCalendar } from "./ical-write";
const source = (range = false) =>
  [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:zoned@example",
    "DTSTART:20260901T090000Z",
    "DTEND:20260901T100000Z",
    "RRULE:FREQ=DAILY;COUNT=5",
    "SUMMARY:Original",
    "END:VEVENT",
    "BEGIN:VEVENT",
    "UID:zoned@example",
    `RECURRENCE-ID;TZID=Europe/Zurich${range ? ";RANGE=THISANDFUTURE" : ""}:20260903T110000`,
    "DTSTART:20260903T093000Z",
    "DTEND:20260903T103000Z",
    "SUMMARY:Moved",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
it.each([false, true])(
  "reads each cross-zone exception once (range=%s)",
  (range) => {
    const rows = expandCalendar(source(range), {
      start: "2026-09-01T00:00:00Z",
      end: "2026-09-06T00:00:00Z",
    });
    expect(rows).toHaveLength(5);
    expect(rows[2]).toMatchObject({
      title: "Moved",
      startsAt: "2026-09-03T09:30:00.000Z",
    });
    expect(rows[3]).toMatchObject({
      title: range ? "Moved" : "Original",
      startsAt: range ? "2026-09-04T09:30:00.000Z" : "2026-09-04T09:00:00.000Z",
    });
  },
);
it("edits an imported zoned exception without creating another identity", () => {
  const ical = source();
  const input = calendarOccurrence(ical, "2026-09-03T09:00:00Z");
  expect(input.title).toBe("Moved");
  const edited = writeCalendar(
    {
      ...input,
      title: "Renamed",
      attendance: "both",
      attendingMemberId: null,
      projectId: null,
      recurrenceRule: null,
    },
    {
      uid: "zoned@example",
      existing: ical,
      recurrenceId: "2026-09-03T09:00:00Z",
    },
  );
  expect(
    readCalendar(edited).calendar.getAllSubcomponents("vevent"),
  ).toHaveLength(2);
  expect(calendarOccurrence(edited, "2026-09-03T09:00:00Z")).toMatchObject({
    title: "Renamed",
    startsAt: "2026-09-03T09:30:00.000Z",
  });
});

it("uses the household zone for a floating master when matching zoned exceptions", () => {
  const floating = source()
    .replace("DTSTART:20260901T090000Z", "DTSTART:20260901T090000")
    .replace("DTEND:20260901T100000Z", "DTEND:20260901T100000")
    .replace("Europe/Zurich:20260903T110000", "Europe/Zurich:20260903T090000");
  const rows = expandCalendar(floating, {
    start: "2026-09-01T00:00:00Z",
    end: "2026-09-06T00:00:00Z",
  });
  expect(rows).toHaveLength(5);
  expect(rows[2]).toMatchObject({
    title: "Moved",
    startsAt: "2026-09-03T09:30:00.000Z",
  });
});
it("keeps one occurrence per identity across timezone representations and series dates", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 2, max: 5 }),
      fc.constantFrom(
        ["Europe/Zurich", "110000"],
        ["Europe/London", "100000"],
        ["America/New_York", "050000"],
      ),
      (day, [zone, time]) => {
        const ical = source().replace(
          "Europe/Zurich:20260903T110000",
          `${zone}:2026090${day}T${time}`,
        );
        const rows = expandCalendar(ical, {
          start: "2026-09-01T00:00:00Z",
          end: "2026-09-06T00:00:00Z",
        });
        expect(rows).toHaveLength(5);
        expect(new Set(rows.map((row) => row.recurrenceId)).size).toBe(5);
        expect(
          calendarOccurrence(ical, `2026-09-0${day}T09:00:00Z`).title,
        ).toBe("Moved");
      },
    ),
  );
});
