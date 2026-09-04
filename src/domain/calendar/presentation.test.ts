import { expect, it } from "vitest";
import { calendarTimePresentation } from "./presentation";
it("labels a custom VTIMEZONE fallback as UTC instead of relabelling the instant", () => {
  expect(
    calendarTimePresentation({
      startsAt: "2026-09-01T08:00:00Z",
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
      timeZone: "Europe/Zurich",
      allDay: false,
    }),
  ).toMatchObject({
    displayTimeZone: "Europe/Zurich",
    formatted: expect.stringContaining("10:00"),
  });
});
