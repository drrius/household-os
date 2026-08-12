import { describe, expect, it } from "vitest";

import {
  addCivilDays,
  formatZurichDayLabel,
  startOfZurichWeek,
  zurichCivilDate,
} from "./zurich-date";

describe("zurich-date", () => {
  it("formats a fixed instant as a Zurich civil date", () => {
    expect(zurichCivilDate(new Date("2026-08-09T10:00:00Z"))).toBe("2026-08-09");
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
});
