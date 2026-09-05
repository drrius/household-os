import { describe, expect, it } from "vitest";
import { expandCalendar, masterFromIcal } from "./ical-read";
import { writeCalendar } from "./ical-write";
import type { CalendarEventInput } from "./types";
const input: CalendarEventInput = {
  title: "Dinner together",
  startsAt: "2026-03-22T17:00:00Z",
  endsAt: "2026-03-22T18:00:00Z",
  timeZone: "Europe/Zurich",
  allDay: false,
  attendance: "both",
  attendingMemberId: null,
  location: "Home",
  notes: "Bring dessert",
  projectId: null,
  recurrenceRule: "FREQ=WEEKLY;COUNT=3",
};
const window = { start: "2026-03-20T00:00:00Z", end: "2026-04-10T00:00:00Z" };
describe("iCalendar round trips and recurrence", () => {
  it("keeps local wall time through daylight-saving changes", () => {
    const ical = writeCalendar(input, { uid: "dinner@example" });
    expect(masterFromIcal(ical).title).toBe(input.title);
    expect(expandCalendar(ical, window).map((item) => item.startsAt)).toEqual([
      "2026-03-22T17:00:00Z",
      "2026-03-29T16:00:00Z",
      "2026-04-05T16:00:00Z",
    ]);
  });
  it("moves one occurrence, cancels another, and preserves the series", () => {
    const base = writeCalendar(input, { uid: "dinner@example" });
    const moved = writeCalendar(
      {
        ...input,
        title: "Dinner out",
        startsAt: "2026-03-30T17:00:00Z",
        endsAt: "2026-03-30T18:00:00Z",
      },
      {
        uid: "dinner@example",
        existing: base,
        recurrenceId: "2026-03-29T18:00:00",
      },
    );
    const cancelled = writeCalendar(input, {
      uid: "dinner@example",
      existing: moved,
      recurrenceId: "2026-04-05T18:00:00",
      cancelled: true,
    });
    expect(expandCalendar(cancelled, window).map((item) => item.title)).toEqual(
      ["Dinner together", "Dinner out"],
    );
    expect(
      expandCalendar(cancelled, {
        start: "2026-03-30T00:00:00Z",
        end: "2026-03-31T00:00:00Z",
      })[0]?.startsAt,
    ).toBe("2026-03-30T17:00:00Z");
  });
  it("retains escaped text and unknown vendor properties", () => {
    const base = writeCalendar(
      { ...input, title: "Dinner, tea; & cake\nTonight" },
      { uid: "dinner@example" },
    ).replace("BEGIN:VEVENT", "BEGIN:VEVENT\r\nX-APPLE-TRAVEL-DURATION:PT30M");
    const edited = writeCalendar(
      { ...input, title: "Changed" },
      { uid: "dinner@example", existing: base },
    );
    expect(edited).toContain("X-APPLE-TRAVEL-DURATION:PT30M");
    expect(masterFromIcal(base).title).toContain(
      "Dinner, tea; & cake\nTonight",
    );
  });
  it("treats all-day end dates as exclusive", () => {
    const ical = writeCalendar(
      {
        ...input,
        allDay: true,
        startsAt: "2026-03-22T00:00:00Z",
        endsAt: "2026-03-24T00:00:00Z",
        recurrenceRule: null,
      },
      { uid: "away@example" },
    );
    expect(masterFromIcal(ical)).toMatchObject({
      allDay: true,
      endsAt: "2026-03-24T00:00:00Z",
    });
  });
  it("skips nonexistent recurring local times", () => {
    const ical = writeCalendar(
      {
        ...input,
        startsAt: "2026-03-22T01:30:00Z",
        endsAt: "2026-03-22T01:45:00Z",
      },
      { uid: "gap@example" },
    );
    expect(expandCalendar(ical, window)).toHaveLength(2);
  });
});

it("round-trips UTC without treating it as a floating Zurich time", () => {
  const ical = writeCalendar(
    { ...input, timeZone: "UTC", recurrenceRule: null },
    { uid: "utc@example" },
  );
  expect(masterFromIcal(ical)).toMatchObject({
    startsAt: "2026-03-22T17:00:00.000Z",
    timeZone: "UTC",
  });
});
it("preserves RDATE/EXDATE and moves all future occurrences", () => {
  const ical = `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:future@example\r\nDTSTART:20260901T090000Z\r\nDTEND:20260901T100000Z\r\nRRULE:FREQ=DAILY;COUNT=5\r\nEXDATE:20260902T090000Z\r\nSUMMARY:Original\r\nEND:VEVENT\r\nBEGIN:VEVENT\r\nUID:future@example\r\nRECURRENCE-ID;RANGE=THISANDFUTURE:20260903T090000Z\r\nDTSTART:20260903T080000Z\r\nDTEND:20260903T100000Z\r\nSUMMARY:Changed future\r\nEND:VEVENT\r\nEND:VCALENDAR`;
  const occurrences = expandCalendar(ical, {
    start: "2026-09-01T00:00:00Z",
    end: "2026-09-06T00:00:00Z",
  });
  expect(occurrences).toHaveLength(4);
  expect(occurrences.at(-1)).toMatchObject({
    title: "Changed future",
    startsAt: "2026-09-05T08:00:00.000Z",
  });
});
it("keeps guest invitation changes inside Apple Calendar", () => {
  const ical = writeCalendar(input, { uid: "guests@example" }).replace(
    "BEGIN:VEVENT",
    "BEGIN:VEVENT\r\nATTENDEE:mailto:guest@example.com",
  );
  expect(() =>
    writeCalendar(input, { uid: "guests@example", existing: ical }),
  ).toThrow("invitations");
});
it("reads embedded custom VTIMEZONE without changing its definition", () => {
  const ical =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VTIMEZONE\r\nTZID:Custom/Fixed\r\nBEGIN:STANDARD\r\nDTSTART:19700101T000000\r\nTZOFFSETFROM:+0200\r\nTZOFFSETTO:+0200\r\nEND:STANDARD\r\nEND:VTIMEZONE\r\nBEGIN:VEVENT\r\nUID:custom@example\r\nDTSTART;TZID=Custom/Fixed:20260901T100000\r\nDTEND;TZID=Custom/Fixed:20260901T110000\r\nSUMMARY:Custom zone\r\nEND:VEVENT\r\nEND:VCALENDAR";
  expect(masterFromIcal(ical)).toMatchObject({
    timeZone: "Custom/Fixed",
    startsAt: "2026-09-01T08:00:00.000Z",
  });
});
