import { expect, it } from "vitest";
import fc from "fast-check";
import { writeCalendar, calendarEditingIssue } from "./ical-write";
import { expandCalendar, masterFromIcal, readCalendar } from "./ical-read";
import { validateCalendarExport } from "./ical-export";
import type { CalendarEventInput } from "./types";
const input: CalendarEventInput = {
  title: "A tentative plan",
  startsAt: "2026-09-01T09:00:00Z",
  endsAt: "2026-09-01T10:00:00Z",
  timeZone: "UTC",
  allDay: false,
  attendance: "both",
  attendingMemberId: null,
  location: "",
  notes: "",
  projectId: null,
  recurrenceRule: "FREQ=DAILY;COUNT=5",
};
const uid = "review@example";
const base = writeCalendar(input, { uid });
const exception = [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  "RECURRENCE-ID;RANGE=THISANDFUTURE:20260903T090000Z",
  "DTSTART:20260903T080000Z",
  "DTEND:20260903T100000Z",
  "SUMMARY:Changed future",
  "STATUS:TENTATIVE",
  "X-APPLE-TRAVEL-DURATION:PT30M",
  "BEGIN:VALARM",
  "ACTION:DISPLAY",
  "DESCRIPTION:Leave soon",
  "TRIGGER:-PT30M",
  "END:VALARM",
  "END:VEVENT",
].join("\r\n");
const series = base.replace("END:VCALENDAR", `${exception}\r\nEND:VCALENDAR`);
it("preserves RANGE, exception alarms, vendor properties and tentative status when editing an existing exception", () => {
  const edited = writeCalendar(
    {
      ...input,
      title: "New title",
      startsAt: "2026-09-03T08:00:00Z",
      endsAt: "2026-09-03T10:00:00Z",
    },
    { uid, existing: series, recurrenceId: "2026-09-03T09:00:00Z" },
  );
  expect(edited).toContain(
    "RECURRENCE-ID;RANGE=THISANDFUTURE:20260903T090000Z",
  );
  expect(edited).toContain("X-APPLE-TRAVEL-DURATION:PT30M");
  expect(edited).toContain("TRIGGER:-PT30M");
  expect(
    readCalendar(edited).calendar.getAllSubcomponents("vevent"),
  ).toHaveLength(2);
  const future = expandCalendar(edited, {
    start: "2026-09-01T00:00:00Z",
    end: "2026-09-06T00:00:00Z",
  }).at(-1);
  expect(future).toMatchObject({
    title: "New title",
    startsAt: "2026-09-05T08:00:00.000Z",
  });
  expect(edited).toContain("STATUS:TENTATIVE");
});
it("blocks timezone-only and all-day series changes when exceptions exist", () => {
  expect(() =>
    writeCalendar(
      {
        ...input,
        timeZone: "Europe/Zurich",
        startsAt: "2026-09-01T07:00:00Z",
        endsAt: "2026-09-01T08:00:00Z",
      },
      { uid, existing: series },
    ),
  ).toThrow("individually changed");
  expect(() =>
    writeCalendar(
      {
        ...input,
        allDay: true,
        startsAt: "2026-09-01T00:00:00Z",
        endsAt: "2026-09-02T00:00:00Z",
      },
      { uid, existing: series },
    ),
  ).toThrow("individually changed");
});
it("preserves tentative on ordinary master edits and confirms explicit restoration", () => {
  const tentative = base.replace("STATUS:CONFIRMED", "STATUS:TENTATIVE");
  const edited = writeCalendar(
    { ...input, title: "Renamed" },
    { uid, existing: tentative },
  );
  expect(edited).toContain("STATUS:TENTATIVE");
  const cancelled = writeCalendar(input, {
    uid,
    existing: tentative,
    cancelled: true,
  });
  expect(writeCalendar(input, { uid, existing: cancelled })).toContain(
    "STATUS:CONFIRMED",
  );
});
it("keeps supported exception alarms in validated exports", () =>
  expect(() => validateCalendarExport(series, uid)).not.toThrow());
it.each([
  [
    "nested event",
    base.replace(
      "END:VCALENDAR",
      "BEGIN:VTIMEZONE\r\nTZID:Fake\r\nBEGIN:VEVENT\r\nUID:other@example\r\nEND:VEVENT\r\nEND:VTIMEZONE\r\nEND:VCALENDAR",
    ),
  ],
  ["wrong UID", base.replaceAll(uid, "wrong@example")],
  [
    "invitation",
    base.replace(
      "BEGIN:VEVENT",
      "BEGIN:VEVENT\r\nATTENDEE:mailto:guest@example.com",
    ),
  ],
  [
    "exception invitation",
    series.replace(
      "SUMMARY:Changed future",
      "SUMMARY:Changed future\r\nORGANIZER:mailto:guest@example.com",
    ),
  ],
  [
    "scheduling method",
    base.replace("VERSION:2.0", "VERSION:2.0\r\nMETHOD:REQUEST"),
  ],
  [
    "non-event component",
    base.replace(
      "END:VCALENDAR",
      "BEGIN:VTODO\r\nSUMMARY:Task\r\nEND:VTODO\r\nEND:VCALENDAR",
    ),
  ],
  ["email alarm", series.replace("ACTION:DISPLAY", "ACTION:EMAIL")],
  [
    "backwards interval",
    base.replace("DTEND:20260901T100000Z", "DTEND:20260831T100000Z"),
  ],
  [
    "duplicate exception",
    series.replace("END:VCALENDAR", `${exception}\r\nEND:VCALENDAR`),
  ],
  [
    "exception UID",
    series.replace(
      `UID:${uid}\r\nRECURRENCE-ID`,
      "UID:other@example\r\nRECURRENCE-ID",
    ),
  ],
  [
    "ambiguous end",
    base.replace(
      "DTEND:20260901T100000Z",
      "DTEND:20260901T100000Z\r\nDURATION:PT1H",
    ),
  ],
])("rejects %s at the export boundary", (_, ical) =>
  expect(() => validateCalendarExport(ical, uid)).toThrow(),
);
it("does not expand an event ending exactly at the window start", () => {
  const once = writeCalendar({ ...input, recurrenceRule: null }, { uid });
  expect(
    expandCalendar(once, {
      start: "2026-09-01T10:00:00Z",
      end: "2026-09-02T00:00:00Z",
    }),
  ).toEqual([]);
  expect(masterFromIcal(once).title).toBe(input.title);
});

it("does not add a status to an existing event that had none", () => {
  const existing = base.replace("STATUS:CONFIRMED\r\n", "");
  expect(
    writeCalendar({ ...input, title: "Renamed" }, { uid, existing }),
  ).not.toContain("STATUS:");
});

it("preserves unsupported end-time zones by refusing local edits", () => {
  const customEnd = base.replace(
    "DTEND:20260901T100000Z",
    "DTEND;TZID=Custom/Office:20260901T100000",
  );
  expect(calendarEditingIssue(customEnd)).toContain("custom time zone");
  expect(() =>
    writeCalendar({ ...input, title: "Changed" }, { uid, existing: customEnd }),
  ).toThrow("custom time zone");
});

const zonedException = [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  "RECURRENCE-ID;TZID=Europe/Zurich:20260903T110000",
  "DTSTART:20260903T093000Z",
  "DTEND:20260903T103000Z",
  "SUMMARY:Later appointment",
  "END:VEVENT",
].join("\r\n");
it("validates exception identities by instant across time zones", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 5 }),
      fc.constantFrom(
        ["Europe/Zurich", "110000"],
        ["Europe/London", "100000"],
        ["America/New_York", "050000"],
      ),
      (day, [zone, time]) => {
        const exception = zonedException.replace(
          "Europe/Zurich:20260903T110000",
          `${zone}:2026090${day}T${time}`,
        );
        const imported = base.replace(
          "END:VCALENDAR",
          `${exception}\r\nEND:VCALENDAR`,
        );
        expect(() => validateCalendarExport(imported, uid)).not.toThrow();
      },
    ),
  );
});
it("rejects duplicate exception identities written in different zones", () => {
  const utcException = zonedException.replace(
    "RECURRENCE-ID;TZID=Europe/Zurich:20260903T110000",
    "RECURRENCE-ID:20260903T090000Z",
  );
  const imported = base.replace(
    "END:VCALENDAR",
    `${zonedException}\r\n${utcException}\r\nEND:VCALENDAR`,
  );
  expect(() => validateCalendarExport(imported, uid)).toThrow(
    "repeats an occurrence identity",
  );
});
