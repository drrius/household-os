import { describe, expect, it, vi } from "vitest";

import { buildPlanViewModel } from "./plan";

vi.mock("server-only", () => ({}));

describe("buildPlanViewModel", () => {
  it("maps a requested date to its Monday-to-Sunday week", () => {
    const plan = buildPlanViewModel({
      weekStartParam: "2025-08-06",
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
    expect(plan.rangeLabel).toBe("4 – 10 August");
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
      weekStartParam: "2026-09-02",
      today: "2026-09-02",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2026-08-31");
    expect(plan.weekEnd).toBe("2026-09-06");
    expect(plan.rangeLabel).toBe("31 August – 6 September");
  });

  it("labels a week that crosses a year boundary", () => {
    const plan = buildPlanViewModel({
      weekStartParam: "2025-12-31",
      today: "2025-12-31",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2025-12-29");
    expect(plan.weekEnd).toBe("2026-01-04");
    expect(plan.rangeLabel).toBe("29 December 2025 – 4 January 2026");
  });

  it("falls back to today's week for an invalid query date", () => {
    const plan = buildPlanViewModel({
      weekStartParam: "not-a-date",
      today: "2026-08-12",
      entries: [],
      library: [],
      prep: [],
    });

    expect(plan.weekStart).toBe("2026-08-10");
    expect(plan.weekEnd).toBe("2026-08-16");
  });
});
