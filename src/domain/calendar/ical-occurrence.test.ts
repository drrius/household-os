import { expect, it } from "vitest";
import { expandCalendar, readCalendar } from "./ical-read";
import { writeCalendar } from "./ical-write";
import { validateCalendarExport } from "./ical-export";
import type { CalendarEventInput } from "./types";
const input: CalendarEventInput = {
  title: "Original",
  startsAt: "2026-09-01T09:00:00Z",
  endsAt: "2026-09-01T10:00:00Z",
  timeZone: "UTC",
  allDay: false,
  attendance: "both",
  attendingMemberId: null,
  location: "Home",
  notes: "Original notes",
  projectId: null,
  recurrenceRule: "FREQ=DAILY;COUNT=5",
};
const uid = "series@example";
const base = writeCalendar(input, { uid });
const window = { start: "2026-09-01T00:00:00Z", end: "2026-09-07T00:00:00Z" };
const identity = (day: number) => `2026-09-0${day}T09:00:00Z`;
function exception(
  day: number,
  range = true,
  start = "080000",
  summary = "Changed future",
) {
  return [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `RECURRENCE-ID${range ? ";RANGE=THISANDFUTURE" : ""}:2026090${day}T090000Z`,
    `DTSTART:2026090${day}T${start}Z`,
    `DTEND:2026090${day}T100000Z`,
    `SUMMARY:${summary}`,
    "DESCRIPTION:Keep future details",
    "STATUS:TENTATIVE",
    "X-APPLE-TRAVEL-DURATION:PT30M",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Leave soon",
    "TRIGGER:-PT30M",
    "END:VALARM",
    "END:VEVENT",
  ].join("\r\n");
}
const withExceptions = (...parts: string[]) =>
  base.replace("END:VCALENDAR", parts.join("\r\n") + "\r\nEND:VCALENDAR");
function cancelPoint(ical: string, day: number) {
  return writeCalendar(input, {
    uid,
    existing: ical,
    recurrenceId: identity(day),
    cancelled: true,
  });
}
it("cancels a RANGE boundary without changing any following occurrence", () => {
  const series = withExceptions(exception(3)),
    before = expandCalendar(series, window);
  const result = cancelPoint(series, 3),
    parsed = readCalendar(result);
  expect(expandCalendar(result, window)).toEqual(
    before.filter((item) => item.recurrenceId !== identity(3)),
  );
  const cancelled = parsed.calendar
    .getAllSubcomponents("vevent")
    .find(
      (item) =>
        String(item.getFirstPropertyValue("recurrence-id")) === identity(3),
    )!;
  expect(
    cancelled.getFirstProperty("recurrence-id")?.getParameter("range"),
  ).toBeUndefined();
  expect(cancelled.getFirstPropertyValue("status")).toBe("CANCELLED");
  expect(result).toContain(
    "RECURRENCE-ID;RANGE=THISANDFUTURE:20260904T090000Z",
  );
  expect(result).toContain("X-APPLE-TRAVEL-DURATION:PT30M");
  expect(() => validateCalendarExport(result, uid)).not.toThrow();
});
it("cancels a terminal bounded RANGE occurrence without adding another date", () => {
  const series = withExceptions(exception(5)),
    before = expandCalendar(series, window);
  const result = cancelPoint(series, 5);
  expect(expandCalendar(result, window)).toEqual(
    before.filter((item) => item.recurrenceId !== identity(5)),
  );
  expect(result).not.toContain("RANGE=THISANDFUTURE");
  expect(
    readCalendar(result).calendar.getAllSubcomponents("vevent"),
  ).toHaveLength(2);
});
it.each([false, true])(
  "preserves the next explicit exception while continuing the original range (next range=%s)",
  (nextRange) => {
    const series = withExceptions(
        exception(3),
        exception(4, nextRange, "070000", "Next change"),
      ),
      before = expandCalendar(series, window);
    expect(expandCalendar(cancelPoint(series, 3), window)).toEqual(
      before.filter((item) => item.recurrenceId !== identity(3)),
    );
  },
);
it("cancels an ordinary inherited occurrence using that occurrence's actual snapshot", () => {
  const series = withExceptions(exception(3)),
    before = expandCalendar(series, window);
  const result = cancelPoint(series, 4);
  expect(expandCalendar(result, window)).toEqual(
    before.filter((item) => item.recurrenceId !== identity(4)),
  );
  expect(result).toContain("DTSTART:20260904T080000Z");
  const target = readCalendar(result)
    .calendar.getAllSubcomponents("vevent")
    .find(
      (item) =>
        String(item.getFirstPropertyValue("recurrence-id")) === identity(4),
    )!;
  expect(String(target.getFirstPropertyValue("dtstart"))).toBe(
    "2026-09-04T08:00:00Z",
  );
  expect(target.getFirstPropertyValue("summary")).toBe("Changed future");
  expect(
    target.getFirstProperty("recurrence-id")?.getParameter("range"),
  ).toBeUndefined();
});
it.each([
  [
    "nonrecurring",
    writeCalendar({ ...input, recurrenceRule: null }, { uid }),
    identity(1),
  ],
  ["COUNT", base, identity(6)],
  [
    "UNTIL",
    base.replace("FREQ=DAILY;COUNT=5", "FREQ=DAILY;UNTIL=20260903T090000Z"),
    identity(4),
  ],
  [
    "EXDATE",
    base.replace("BEGIN:VEVENT", "BEGIN:VEVENT\r\nEXDATE:20260902T090000Z"),
    identity(2),
  ],
  ["wrong value type", base, "2026-09-02"],
  ["invalid date", base, "2026-09-32T09:00:00Z"],
])(
  "rejects an identity outside the actual %s series for both edit and cancellation",
  (_, ical, recurrenceId) => {
    expect(() =>
      writeCalendar(input, { uid, existing: ical, recurrenceId }),
    ).toThrow();
    expect(() =>
      writeCalendar(input, {
        uid,
        existing: ical,
        recurrenceId,
        cancelled: true,
      }),
    ).toThrow();
  },
);
it("accepts an explicit RDATE and rejects dates after its last occurrence", () => {
  const series = base.replace(
    "RRULE:FREQ=DAILY;COUNT=5",
    "RDATE:20260903T090000Z",
  );
  expect(() => cancelPoint(series, 3)).not.toThrow();
  expect(() => cancelPoint(series, 4)).toThrow("outside");
});

it("rejects orphan exceptions at the export boundary too", () => {
  expect(() =>
    validateCalendarExport(withExceptions(exception(6, false)), uid),
  ).toThrow("outside");
  expect(base).toMatch(/DTSTAMP:\d{8}T\d{6}Z/u);
});
