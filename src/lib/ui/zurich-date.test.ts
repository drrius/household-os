import { describe, expect, it } from "vitest";

import {
  addCivilDays,
  formatCivilDateRangeLabel,
  formatZurichDayLabel,
  formatZurichTimestamp,
  startOfZurichWeek,
  zurichCivilDate,
} from "./zurich-date";

describe("zurich-date", () => {
  it("formats a fixed instant as a Zurich civil date", () => {
    expect(zurichCivilDate(new Date("2026-08-09T10:00:00Z"))).toBe(
      "2026-08-09",
    );
  });

  it("formats Zurich timestamps with deterministic punctuation", () => {
    expect(formatZurichTimestamp("2026-08-12T11:53:00Z")).toBe(
      "12 Aug 2026, 13:53",
    );
    expect(formatZurichTimestamp("2026-01-12T11:53:00Z")).toBe(
      "12 Jan 2026, 12:53",
    );
  });

  it("rejects invalid timestamps", () => {
    expect(() => formatZurichTimestamp("not-a-date")).toThrow(RangeError);
  });

  it("adds civil days without floating-point time math", () => {
    expect(addCivilDays("2026-08-09", 1)).toBe("2026-08-10");
    expect(addCivilDays("2026-08-31", 1)).toBe("2026-09-01");
  });

  it("finds Monday for midweek and Sunday dates", () => {
    expect(startOfZurichWeek("2026-08-09")).toBe("2026-08-03");
    expect(startOfZurichWeek("2026-08-10")).toBe("2026-08-10");
    expect(startOfZurichWeek("2026-08-16")).toBe("2026-08-10");
  });

  it("labels a civil date for display", () => {
    expect(formatZurichDayLabel("2026-08-09")).toMatch(/August/);
  });

  it("labels a date range without repeating the shared parts", () => {
    expect(formatCivilDateRangeLabel("2026-08-24", "2026-08-30")).toBe(
      "24 – 30 Aug",
    );
    expect(formatCivilDateRangeLabel("2026-08-31", "2026-09-06")).toBe(
      "31 Aug – 6 Sept",
    );
    expect(formatCivilDateRangeLabel("2025-12-29", "2026-01-04")).toBe(
      "29 Dec 2025 – 4 Jan 2026",
    );
  });

  it("rejects invalid civil dates", () => {
    expect(() => addCivilDays("not-a-date", 1)).toThrow(RangeError);
    expect(() => startOfZurichWeek("not-a-date")).toThrow(RangeError);
    expect(() => formatZurichDayLabel("not-a-date")).toThrow(RangeError);
  });
});
