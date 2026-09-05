import { expect, it } from "vitest";
import { occursOnDay } from "./interval";
it("includes an event through midnight only on the preceding day", () => {
  const event = {
    startsAt: "2026-09-06T21:00:00Z",
    endsAt: "2026-09-06T22:00:00Z",
    allDay: false,
  };
  expect(occursOnDay(event, "2026-09-06")).toBe(true);
  expect(occursOnDay(event, "2026-09-07")).toBe(false);
});
it("keeps daytime and zero-duration events on their own day", () => {
  expect(
    occursOnDay(
      {
        startsAt: "2026-09-07T09:00:00Z",
        endsAt: "2026-09-07T10:00:00Z",
        allDay: false,
      },
      "2026-09-07",
    ),
  ).toBe(true);
  expect(
    occursOnDay(
      {
        startsAt: "2026-09-06T22:00:00Z",
        endsAt: "2026-09-06T22:00:00Z",
        allDay: false,
      },
      "2026-09-07",
    ),
  ).toBe(true);
});
it("uses the actual Zurich day across clock changes", () => {
  const event = {
    startsAt: "2026-03-29T20:00:00Z",
    endsAt: "2026-03-29T22:00:00Z",
    allDay: false,
  };
  expect(occursOnDay(event, "2026-03-29")).toBe(true);
  expect(occursOnDay(event, "2026-03-30")).toBe(false);
});
