import { describe, expect, it } from "vitest";

import { dueDraftDates, nextDraftDate } from "./recurrence";
import type { RecurringExpenseSchedule } from "./types";
import { asIsoDate, asMonthlyDay } from "./values";

describe("recurring expense draft dates", () => {
  it("finds the next weekly ISO weekday strictly after the anchor", () => {
    const schedule: RecurringExpenseSchedule = {
      kind: "weekly",
      weekday: 1,
    };
    expect(nextDraftDate(schedule, asIsoDate("2026-08-11"))).toBe("2026-08-17");
    expect(nextDraftDate(schedule, asIsoDate("2026-08-17"))).toBe("2026-08-24");
  });

  it("finds monthly fixed dates and clamps short months", () => {
    const schedule: RecurringExpenseSchedule = {
      kind: "monthly",
      dayOfMonth: asMonthlyDay(31),
    };
    expect(nextDraftDate(schedule, asIsoDate("2026-01-31"))).toBe("2026-02-28");
    expect(nextDraftDate(schedule, asIsoDate("2026-02-28"))).toBe("2026-03-31");
  });

  it("lists weekly draft dates in an inclusive due window", () => {
    expect(
      dueDraftDates(
        { kind: "weekly", weekday: 1 },
        asIsoDate("2026-08-10"),
        asIsoDate("2026-08-24"),
      ),
    ).toEqual(["2026-08-10", "2026-08-17", "2026-08-24"]);
  });

  it("lists monthly draft dates in an inclusive due window", () => {
    expect(
      dueDraftDates(
        { kind: "monthly", dayOfMonth: asMonthlyDay(31) },
        asIsoDate("2026-01-01"),
        asIsoDate("2026-04-30"),
      ),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });

  it("rejects invalid monthly fixed dates", () => {
    expect(() => asMonthlyDay(0)).toThrow();
    expect(() => asMonthlyDay(1.5)).toThrow();
  });
});
