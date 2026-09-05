import { expect, it } from "vitest";
import { validateCalendarExport } from "./ical-export";
import { calendarEditingIssue, writeCalendar } from "./ical-write";

function resource(trigger: string) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:alarm@example",
    "DTSTART:20260901T090000Z",
    "DTEND:20260901T100000Z",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Reminder",
    trigger,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

it.each([
  "TRIGGER;VALUE=DATE-TIME;TZID=America/New_York:20260901T040000",
  "TRIGGER;VALUE=DATE-TIME:20260901T080000",
  "TRIGGER;VALUE=DATE-TIME;RELATED=START:20260901T080000Z",
  "TRIGGER;TZID=America/New_York:-PT30M",
  "TRIGGER;RELATED=INVALID:-PT30M",
])("rejects an invalid alarm before editing or export: %s", (trigger) => {
  const ical = resource(trigger);
  expect(calendarEditingIssue(ical)).toMatch(/alarm.*Apple Calendar/);
  expect(() => validateCalendarExport(ical, "alarm@example")).toThrow(/alarm/);
});

it.each([
  "TRIGGER;VALUE=DATE-TIME:20260901T080000Z",
  "TRIGGER:-PT30M",
  "TRIGGER;RELATED=END:-PT30M",
])("preserves a standards-compliant alarm: %s", (trigger) => {
  const ical = resource(trigger);
  expect(calendarEditingIssue(ical)).toBeNull();
  expect(() => validateCalendarExport(ical, "alarm@example")).not.toThrow();
});

it.each([false, true])(
  "rejects an invalid exception alarm before changing the series (cancelled=%s)",
  (cancelled) => {
    const exception = resource(
      "TRIGGER;VALUE=DATE-TIME;TZID=America/New_York:20260902T040000",
    )
      .replaceAll("20260901", "20260902")
      .split("BEGIN:VEVENT")[1]!
      .split("END:VCALENDAR")[0]!;
    const ical = resource("TRIGGER:-PT30M")
      .replace("BEGIN:VALARM", "RRULE:FREQ=DAILY;COUNT=3\r\nBEGIN:VALARM")
      .replace(
        "END:VCALENDAR",
        `BEGIN:VEVENT\r\nRECURRENCE-ID:20260902T090000Z${exception}END:VCALENDAR`,
      );
    expect(() =>
      writeCalendar(
        {
          title: "Changed series",
          startsAt: "2026-09-01T09:00:00Z",
          endsAt: "2026-09-01T10:00:00Z",
          timeZone: "UTC",
          allDay: false,
          attendance: "both",
          attendingMemberId: null,
          location: "",
          notes: "",
          projectId: null,
          recurrenceRule: "FREQ=DAILY;COUNT=3",
        },
        { uid: "alarm@example", existing: ical, cancelled },
      ),
    ).toThrow(/alarm.*Apple Calendar/);
  },
);
