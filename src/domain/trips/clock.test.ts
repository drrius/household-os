import { expect, it } from "vitest";
import fc from "fast-check";
import {
  bookingInstant,
  bookingLocalTime,
  bookingClockChoice,
  validateBookingZone,
} from "./clock";
it("keeps independent flight time zones and rejects nonexistent local times", () => {
  expect(bookingInstant("2026-09-05T10:00", "Europe/Zurich", "reject")).toBe(
    "2026-09-05T08:00:00Z",
  );
  expect(bookingInstant("2026-09-05T13:00", "America/New_York", "reject")).toBe(
    "2026-09-05T17:00:00Z",
  );
  for (const choice of ["reject", "earlier", "later"] as const)
    expect(() =>
      bookingInstant("2026-03-29T02:30", "Europe/Zurich", choice),
    ).toThrow();
  expect(() => validateBookingZone("+02:00")).toThrow("named");
});
it("requires a choice for repeated times and preserves each occurrence", () => {
  const local = "2026-10-25T02:30";
  expect(() => bookingInstant(local, "Europe/Zurich", "reject")).toThrow(
    "repeated",
  );
  expect(bookingInstant(local, "Europe/Zurich", "earlier")).toBe(
    "2026-10-25T00:30:00Z",
  );
  expect(bookingInstant(local, "Europe/Zurich", "later")).toBe(
    "2026-10-25T01:30:00Z",
  );
});
it("round trips exact saved instants including sub-second precision and DST", () => {
  fc.assert(
    fc.property(
      fc.date({
        min: new Date("2020-01-01"),
        max: new Date("2035-01-01"),
        noInvalidDate: true,
      }),
      fc.constantFrom(
        "Europe/Zurich",
        "America/New_York",
        "Pacific/Auckland",
        "Asia/Tokyo",
      ),
      (date, zone) => {
        const instant = date.toISOString();
        expect(
          new Date(
            bookingInstant(
              bookingLocalTime(instant, zone),
              zone,
              bookingClockChoice(instant, zone),
              instant,
            )!,
          ).getTime(),
        ).toBe(date.getTime());
      },
    ),
  );
});
