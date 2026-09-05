import { expect, it } from "vitest";
import { validateCalendarExport } from "./ical-export";
import { calendarEditingIssue } from "./ical-write";

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
