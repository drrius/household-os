import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  allDayBounds,
  calendarWeek,
  isTimeZone,
  isoToLocalDateTime,
  lastAllDayDate,
  localDateTimeToIso,
} from "./date-time";

describe("calendar time boundaries", () => {
  it("converts local times using their own zone rather than the server zone", () => {
    expect(localDateTimeToIso("2026-07-10T10:00", "Europe/Zurich")).toBe(
      "2026-07-10T08:00:00Z",
    );
    expect(localDateTimeToIso("2026-01-10T10:00", "Europe/Zurich")).toBe(
      "2026-01-10T09:00:00Z",
    );
    expect(isoToLocalDateTime("2026-07-10T08:00:00Z", "Asia/Tokyo")).toBe(
      "2026-07-10T17:00",
    );
  });
  it("rejects nonexistent and ambiguous clock-change times", () => {
    expect(() =>
      localDateTimeToIso("2026-03-29T02:30", "Europe/Zurich"),
    ).toThrow("clocks change");
    expect(() =>
      localDateTimeToIso("2026-10-25T02:30", "Europe/Zurich"),
    ).toThrow("clocks change");
    expect(isTimeZone("Europe/NotAPlace")).toBe(false);
  });
  it("stores all-day ranges with exclusive end dates", () => {
    expect(allDayBounds("2028-02-28", "2028-02-29")).toEqual({
      startsAt: "2028-02-28T00:00:00Z",
      endsAt: "2028-03-01T00:00:00Z",
    });
    expect(lastAllDayDate("2028-03-01T00:00:00Z")).toBe("2028-02-29");
    expect(() => allDayBounds("2028-03-02", "2028-03-01")).toThrow();
  });
  it("uses Monday to Sunday across year boundaries", () => {
    expect(calendarWeek("2027-01-01")).toMatchObject({
      start: "2026-12-28",
      end: "2027-01-04",
      previous: "2026-12-21",
      next: "2027-01-04",
    });
  });
  it("property: noon survives a round trip across zones and seasonal offsets", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2020, max: 2040 }),
        fc.integer({ min: 1, max: 12 }),
        fc.integer({ min: 1, max: 28 }),
        fc.constantFrom(
          "Europe/Zurich",
          "America/New_York",
          "Asia/Tokyo",
          "Pacific/Auckland",
        ),
        (year, month, day, zone) => {
          const local = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}T12:30`;
          expect(
            isoToLocalDateTime(localDateTimeToIso(local, zone), zone),
          ).toBe(local);
        },
      ),
    );
  });
});
