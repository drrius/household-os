import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { addDays, compareIsoDates, isoWeekday } from "./dates";
import {
  firstDueDateOnOrAfter,
  nextAfterCompletionDueDate,
  nextCalendarDueDate,
  nextDueAfterClosure,
  validateScheduleRule,
} from "./schedule";
import { asIsoDate, type IsoWeekday } from "./types";

const isoDateArbitrary = fc
  .integer({
    min: Date.UTC(2020, 0, 1),
    max: Date.UTC(2035, 11, 31),
  })
  .map((utc) => {
    const date = new Date(utc);
    const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
    const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(date.getUTCDate()).padStart(2, "0");
    return asIsoDate(`${yyyy}-${mm}-${dd}`);
  });

describe("validateScheduleRule", () => {
  it("rejects calendar rules under after_completion kind", () => {
    const result = validateScheduleRule("after_completion", { kind: "daily" });
    expect(result.ok).toBe(false);
  });

  it("accepts selected weekdays sorted uniquely", () => {
    const result = validateScheduleRule("calendar", {
      kind: "weekdays",
      days: [5, 1, 3],
    });
    expect(result).toEqual({
      ok: true,
      rule: { kind: "weekdays", days: [1, 3, 5] },
    });
  });
});

describe("calendar recurrence", () => {
  it("daily advances one civil day", () => {
    expect(
      nextCalendarDueDate({ kind: "daily" }, asIsoDate("2026-08-09")),
    ).toBe("2026-08-10");
  });

  it("weekly lands on the requested weekday", () => {
    const due = nextCalendarDueDate(
      { kind: "weekly", weekday: 1 },
      asIsoDate("2026-08-09"),
    );
    expect(isoWeekday(due)).toBe(1);
    expect(compareIsoDates(due, asIsoDate("2026-08-09"))).toBe(1);
  });

  it("monthly clamps to the final day of shorter months", () => {
    expect(
      nextCalendarDueDate(
        { kind: "monthly", dayOfMonth: 31 },
        asIsoDate("2026-01-31"),
      ),
    ).toBe("2026-02-28");
  });

  it("calendar next due is always strictly after the anchor", () => {
    fc.assert(
      fc.property(
        isoDateArbitrary,
        fc.constantFrom<IsoWeekday>(1, 2, 3, 4, 5, 6, 7),
        fc.integer({ min: 1, max: 31 }),
        (anchor, weekday, dayOfMonth) => {
          const daily = nextCalendarDueDate({ kind: "daily" }, anchor);
          const weekly = nextCalendarDueDate(
            { kind: "weekly", weekday },
            anchor,
          );
          const monthly = nextCalendarDueDate(
            { kind: "monthly", dayOfMonth },
            anchor,
          );

          expect(compareIsoDates(daily, anchor)).toBe(1);
          expect(compareIsoDates(weekly, anchor)).toBe(1);
          expect(compareIsoDates(monthly, anchor)).toBe(1);
          expect(isoWeekday(weekly)).toBe(weekday);
        },
      ),
    );
  });

  it("weekdays recurrence only lands on selected days", () => {
    fc.assert(
      fc.property(
        isoDateArbitrary,
        fc.uniqueArray(fc.constantFrom<IsoWeekday>(1, 2, 3, 4, 5, 6, 7), {
          minLength: 1,
          maxLength: 7,
        }),
        (anchor, days) => {
          const next = nextCalendarDueDate({ kind: "weekdays", days }, anchor);
          expect(days).toContain(isoWeekday(next));
          expect(compareIsoDates(next, anchor)).toBe(1);
        },
      ),
    );
  });
});

describe("completion-based recurrence", () => {
  it("anchors the next due date to the completion day", () => {
    expect(
      nextAfterCompletionDueDate(
        { kind: "after_completion", every: 3, unit: "days" },
        asIsoDate("2026-08-09"),
      ),
    ).toBe("2026-08-12");

    expect(
      nextAfterCompletionDueDate(
        { kind: "after_completion", every: 2, unit: "weeks" },
        asIsoDate("2026-08-09"),
      ),
    ).toBe("2026-08-23");
  });

  it("completion cadence ignores the prior due date", () => {
    fc.assert(
      fc.property(
        isoDateArbitrary,
        isoDateArbitrary,
        fc.integer({ min: 1, max: 60 }),
        fc.constantFrom<"days" | "weeks">("days", "weeks"),
        (dueDate, completedOn, every, unit) => {
          const rule = { kind: "after_completion" as const, every, unit };
          const next = nextDueAfterClosure({
            rule,
            closedDueDate: dueDate,
            completedOn,
          });
          const expected = nextAfterCompletionDueDate(rule, completedOn);
          expect(next).toBe(expected);
        },
      ),
    );
  });

  it("skip preserves cadence from the closed due date", () => {
    const rule = {
      kind: "after_completion" as const,
      every: 5,
      unit: "days" as const,
    };
    const due = asIsoDate("2026-08-01");
    expect(nextDueAfterClosure({ rule, closedDueDate: due })).toBe(
      addDays(due, 5),
    );
  });
});

describe("one-off schedules", () => {
  it("produce no successor after closure", () => {
    const date = asIsoDate("2026-08-09");
    expect(
      nextDueAfterClosure({
        rule: { kind: "one_off", date },
        closedDueDate: date,
        completedOn: date,
      }),
    ).toBeNull();
  });

  it("first due date is the configured date", () => {
    const date = asIsoDate("2026-12-25");
    expect(
      firstDueDateOnOrAfter({ kind: "one_off", date }, asIsoDate("2026-01-01")),
    ).toBe(date);
  });
});

describe("firstDueDateOnOrAfter", () => {
  it("returns the start day for daily routines", () => {
    const start = asIsoDate("2026-08-09");
    expect(firstDueDateOnOrAfter({ kind: "daily" }, start)).toBe(start);
  });
});
