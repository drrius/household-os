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
      weekStartParam: "2026-09-02",
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
      weekStartParam: "2025-12-31",
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

describe("weekly meal ideas", () => {
  it("shows unscheduled entries without occupying a meal slot", () => {
    const plan = buildPlanViewModel({
      today: "2026-09-05",
      entries: [
        {
          id: "idea",
          date: "2026-08-31",
          slot: null,
          title_snapshot: "Pizza night",
          notes: "Try the new dough",
          leftover_of_entry_id: null,
        },
      ],
      library: [],
      prep: [],
    });
    expect(plan.ideas).toEqual([
      { id: "idea", title: "Pizza night", notes: "Try the new dough" },
    ]);
    expect(
      plan.days
        .flatMap((day) => day.slots)
        .every((slot) => slot.entry === null),
    ).toBe(true);
  });
});

describe("household week", () => {
  const entry = {
    id: "trip:japan",
    kind: "trip" as const,
    title: "Japan together",
    time: null,
    detail: "Tokyo",
    href: "/plan/projects/japan",
    continues: false,
  };
  const routine = {
    occurrenceId: "occ",
    title: "Water plants",
    meta: "anyone",
    tone: "open" as const,
    canComplete: true,
  };

  it("places the week's plans and routines beside each day's meals", () => {
    const plan = buildPlanViewModel({
      weekStartParam: "2026-09-07",
      today: "2026-09-09",
      entries: [],
      library: [],
      prep: [],
      week: {
        days: [
          { date: "2026-09-08", plans: [entry], routines: [] },
          { date: "2026-09-09", plans: [], routines: [routine] },
        ],
        warnings: [{ id: "broken", title: "Dentist" }],
        syncAttention: 2,
      },
    });
    expect(plan.week).toEqual({
      status: "ready",
      warnings: [{ id: "broken", title: "Dentist" }],
      syncAttention: 2,
    });
    expect(plan.days[1]).toMatchObject({ date: "2026-09-08", plans: [entry] });
    expect(plan.days[2]).toMatchObject({
      date: "2026-09-09",
      routines: [routine],
    });
    expect(plan.days[0]).toMatchObject({ plans: [], routines: [] });
    expect(plan.days[0]?.slots).toHaveLength(3);
  });

  it("keeps meals when the week's plans are unavailable", () => {
    const plan = buildPlanViewModel({
      weekStartParam: "2026-09-07",
      today: "2026-09-09",
      entries: [
        {
          id: "dinner",
          date: "2026-09-09",
          slot: "dinner",
          title_snapshot: "Rösti",
          notes: null,
          leftover_of_entry_id: null,
        },
      ],
      library: [],
      prep: [],
      week: null,
    });
    expect(plan.week).toEqual({
      status: "unavailable",
      warnings: [],
      syncAttention: 0,
    });
    expect(plan.days[2]?.slots[2]?.entry?.title).toBe("Rösti");
    expect(plan.days.every((day) => day.plans.length === 0)).toBe(true);
  });
});
