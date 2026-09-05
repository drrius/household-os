import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { recurringStartMatchesSchedule } from "@/lib/ai/schedule";

describe("recurringStartMatchesSchedule", () => {
  it("accepts only start dates that land on the schedule", () => {
    // 2026-09-07 is a Monday; day 31 clamps to February's length.
    expect(
      recurringStartMatchesSchedule(
        { kind: "weekly", isoWeekday: 1 },
        "2026-09-07",
      ),
    ).toBe(true);
    expect(
      recurringStartMatchesSchedule(
        { kind: "weekly", isoWeekday: 2 },
        "2026-09-07",
      ),
    ).toBe(false);
    expect(
      recurringStartMatchesSchedule(
        { kind: "monthly", dayOfMonth: 31 },
        "2027-02-28",
      ),
    ).toBe(true);
    expect(
      recurringStartMatchesSchedule(
        { kind: "monthly", dayOfMonth: 15 },
        "2027-02-14",
      ),
    ).toBe(false);
  });

  it("weekly start dates always satisfy the database's isodow check", () => {
    fc.assert(
      fc.property(
        fc.date({
          min: new Date("2026-01-01T00:00:00Z"),
          max: new Date("2030-12-31T00:00:00Z"),
          noInvalidDate: true,
        }),
        fc.integer({ min: 1, max: 7 }),
        (date, isoWeekday) => {
          const iso = date.toISOString().slice(0, 10);
          const utcDay = new Date(`${iso}T00:00:00Z`).getUTCDay();
          const matches = recurringStartMatchesSchedule(
            { kind: "weekly", isoWeekday },
            iso,
          );
          expect(matches).toBe((utcDay === 0 ? 7 : utcDay) === isoWeekday);
        },
      ),
    );
  });
});
