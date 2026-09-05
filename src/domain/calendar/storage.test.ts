import { expect, it } from "vitest";
import { isTimeZone } from "./date-time";
import { calendarMasterForStorage, storageCalendarTimeZone } from "./storage";
import { masterFromIcal, expandCalendar } from "./ical-read";
import { calendarEditingIssue, writeCalendar } from "./ical-write";
const custom = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VTIMEZONE",
  "TZID:Custom/Fixed",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0200",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:custom@example",
  "DTSTART;TZID=Custom/Fixed:20260901T100000",
  "DTEND;TZID=Custom/Fixed:20260901T110000",
  "RRULE:FREQ=DAILY;COUNT=2",
  "SUMMARY:Custom zone",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");
it("stores a supported timezone projection without changing custom resource semantics", () => {
  const stored = calendarMasterForStorage(custom);
  expect(stored).toMatchObject({
    timeZone: "UTC",
    startsAt: "2026-09-01T08:00:00.000Z",
    endsAt: "2026-09-01T09:00:00.000Z",
  });
  expect(masterFromIcal(custom).timeZone).toBe("Custom/Fixed");
  const expanded = expandCalendar(custom, {
    start: "2026-09-01T00:00:00Z",
    end: "2026-09-03T00:00:00Z",
  });
  expect(expanded.map((item) => [item.timeZone, item.startsAt])).toEqual([
    ["Custom/Fixed", "2026-09-01T08:00:00.000Z"],
    ["Custom/Fixed", "2026-09-02T08:00:00.000Z"],
  ]);
  expect(calendarEditingIssue(custom)).toContain("custom time zone");
  expect(() =>
    writeCalendar(stored, { uid: stored.uid, existing: custom }),
  ).toThrow("original definition");
});
it("keeps named zones and rejects numeric offsets that cannot be used as named database/display zones", () => {
  expect(storageCalendarTimeZone("Europe/Zurich")).toBe("Europe/Zurich");
  expect(storageCalendarTimeZone("UTC")).toBe("UTC");
  for (const unsupported of ["Custom/Fixed", "+02:00", "Invalid/Zone"]) {
    expect(isTimeZone(unsupported)).toBe(false);
    expect(storageCalendarTimeZone(unsupported)).toBe("UTC");
  }
});
it("rejects unknown TZIDs without an actual embedded definition", () => {
  const missing = custom.replace(
    /BEGIN:VTIMEZONE[\s\S]*?END:VTIMEZONE\r\n/u,
    "",
  );
  expect(() => calendarMasterForStorage(missing)).toThrow(
    "Unsupported calendar time zone",
  );
});
