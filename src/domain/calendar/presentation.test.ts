import { expect, it } from "vitest";
import { calendarTimePresentation } from "./presentation";
it("labels a custom VTIMEZONE fallback as UTC instead of relabelling the instant", () => {
  expect(
    calendarTimePresentation({
      startsAt: "2026-09-01T08:00:00Z",
      endsAt: "2026-09-01T09:30:00Z",
      timeZone: "Custom/Fixed",
      allDay: false,
    }),
  ).toMatchObject({
    displayTimeZone: "UTC",
    formatted: expect.stringContaining("08:00"),
  });
  expect(
    calendarTimePresentation({
      startsAt: "2026-09-01T08:00:00Z",
      endsAt: "2026-09-01T09:30:00Z",
      timeZone: "Europe/Zurich",
      allDay: false,
    }),
  ).toMatchObject({
    displayTimeZone: "Europe/Zurich",
    formatted: expect.stringContaining("10:00"),
  });
});

it("shows an end time for same-day appointments and both dates across midnight", () => {
  expect(
    calendarTimePresentation({
      startsAt: "2026-09-07T08:00:00Z",
      endsAt: "2026-09-07T10:30:00Z",
      timeZone: "Europe/Zurich",
      allDay: false,
    }).formatted,
  ).toContain("10:00 – 12:30");
  const night = calendarTimePresentation({
    startsAt: "2026-09-07T21:00:00Z",
    endsAt: "2026-09-07T22:00:00Z",
    timeZone: "Europe/Zurich",
    allDay: false,
  }).formatted;
  expect(night).toContain("Monday, 7 September 2026");
  expect(night).toContain("Tuesday, 8 September 2026");
  expect(night).toContain("00:00");
});
it("shows the last occupied date of a multi-day all-day plan", () => {
  const days = calendarTimePresentation({
    startsAt: "2026-09-07T00:00:00Z",
    endsAt: "2026-09-10T00:00:00Z",
    timeZone: "Europe/Zurich",
    allDay: true,
  }).formatted;
  expect(days).toContain("Monday, 7 September 2026");
  expect(days).toContain("Wednesday, 9 September 2026");
  expect(days).not.toContain("10 September");
});
