import { describe, expect, it, vi } from "vitest";

import { buildPlanViewModel } from "./plan";

vi.mock("server-only", () => ({}));

describe("buildPlanViewModel", () => {
  it("maps a requested date to its Monday-to-Sunday week", () => {
    const plan = buildPlanViewModel({
      dateParam: "2025-08-06",
      today: "2025-08-04",
      entries: [
        {
          id: "first",
          date: "2025-08-04",
          slot: "lunch",
          title_snapshot: "Tomato tart",
          notes: "Use the ripe tomatoes",
          leftover_of_entry_id: null,
        },
        {
          id: "duplicate",
          date: "2025-08-04",
          slot: "lunch",
          title_snapshot: "Ignored duplicate",
          notes: null,
          leftover_of_entry_id: null,
        },
        {
          id: "sunday",
          date: "2025-08-10",
          slot: "dinner",
          title_snapshot: "Leftover tart",
          notes: null,
          leftover_of_entry_id: "first",
        },
      ],
      library: [{ id: "meal-1", name: "Tomato tart" }],
      prep: [
        {
          meal_plan_entry_id: "first",
          due_date: "2025-08-04",
          routine: { title: "Blind bake the crust" },
        },
      ],
    });

    expect(plan.weekStart).toBe("2025-08-04");
    expect(plan.weekEnd).toBe("2025-08-10");
    expect(plan.rangeLabel).toBe("4 – 10 Aug");
    expect(plan.days.map((day) => day.date)).toEqual([
      "2025-08-04",
      "2025-08-05",
      "2025-08-06",
      "2025-08-07",
      "2025-08-08",
      "2025-08-09",
      "2025-08-10",
    ]);
    expect(plan.days.map((day) => day.weekdayLabel)).toEqual([
      "Mon 4",
      "Tue 5",
      "Wed 6",
      "Thu 7",
      "Fri 8",
      "Sat 9",
      "Sun 10",
    ]);
    expect(plan.days[0]?.slots[1]?.entry?.id).toBe("first");
    expect(plan.days[0]?.slots[1]?.entry?.cookLabel).toBe(
      "Blind bake the crust",
    );
    expect(plan.days[6]?.slots[2]?.entry?.isLeftover).toBe(true);
    expect(plan.days.filter((day) => day.isToday)).toHaveLength(1);
    expect(plan.library).toEqual([{ id: "meal-1", title: "Tomato tart" }]);
  });

  it("labels a week that crosses a month boundary", () => {
    const plan = buildPlanViewModel({
      dateParam: "2026-09-02",
      today: "2026-09-02",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2026-08-31");
    expect(plan.weekEnd).toBe("2026-09-06");
    expect(plan.rangeLabel).toBe("31 Aug – 6 Sept");
  });

  it("labels a week that crosses a year boundary", () => {
    const plan = buildPlanViewModel({
      dateParam: "2025-12-31",
      today: "2025-12-31",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2025-12-29");
    expect(plan.weekEnd).toBe("2026-01-04");
    expect(plan.rangeLabel).toBe("29 Dec 2025 – 4 Jan 2026");
  });

  it("falls back to today's week for an invalid query date", () => {
    const plan = buildPlanViewModel({
      dateParam: "not-a-date",
      today: "2026-08-12",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2026-08-10");
    expect(plan.weekEnd).toBe("2026-08-16");
    expect(plan.focusedDate).toBe("2026-08-12");
  });

  it("opens on today when no date is asked for", () => {
    const plan = buildPlanViewModel({
      today: "2026-08-30",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.focusedDate).toBe("2026-08-30");
    expect(plan.weekOffset).toBe(0);
    expect(
      plan.days.filter((day) => day.isFocused).map((day) => day.date),
    ).toEqual(["2026-08-30"]);
  });

  it("opens on the requested day of a future week", () => {
    const plan = buildPlanViewModel({
      dateParam: "2026-09-03",
      today: "2026-08-30",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2026-08-31");
    expect(plan.focusedDate).toBe("2026-09-03");
    expect(plan.weekOffset).toBe(1);
    expect(plan.days.some((day) => day.isToday)).toBe(false);
    expect(
      plan.days.filter((day) => day.isFocused).map((day) => day.date),
    ).toEqual(["2026-09-03"]);
  });

  it("counts whole weeks between the shown week and today", () => {
    const weekOffsetFor = (dateParam: string) =>
      buildPlanViewModel({
        dateParam,
        today: "2026-08-30",
        entries: [],
        library: [],
        prep: [],
      }).weekOffset;

    // Sunday is the last day of its week, so tomorrow is already the next one.
    expect(weekOffsetFor("2026-08-31")).toBe(1);
    expect(weekOffsetFor("2026-08-29")).toBe(0);
    expect(weekOffsetFor("2026-08-23")).toBe(-1);
    // Far enough ahead to cross the end of Zurich summer time.
    expect(weekOffsetFor("2026-11-01")).toBe(9);
  });

  it("steps a week at a time from the shown week", () => {
    const plan = buildPlanViewModel({
      dateParam: "2026-08-30",
      today: "2026-08-30",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.previousWeek).toEqual({
      date: "2026-08-17",
      rangeLabel: "17 – 23 Aug",
    });
    expect(plan.nextWeek).toEqual({
      date: "2026-08-31",
      rangeLabel: "31 Aug – 6 Sept",
    });
  });
});
