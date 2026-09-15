import type { PlanViewModel } from "./types";

export const mockPlan: PlanViewModel = {
  weekStart: "2026-09-14",
  weekEnd: "2026-09-20",
  rangeLabel: "14 – 20 Sep 2026",
  days: [
    {
      date: "2026-09-15",
      weekdayLabel: "Tue",
      isToday: true,
      routines: [{ occurrenceId: "occ-1", title: "Feed Milo" }],
      slots: [
        { slot: "breakfast", entry: null },
        { slot: "lunch", entry: null },
        {
          slot: "dinner",
          entry: { id: "meal-1", title: "Rösti night", isLeftover: false },
        },
      ],
    },
    {
      date: "2026-09-16",
      weekdayLabel: "Wed",
      isToday: false,
      routines: [],
      slots: [
        { slot: "breakfast", entry: null },
        { slot: "lunch", entry: null },
        { slot: "dinner", entry: null },
      ],
    },
  ],
  library: [{ id: "lib-1", title: "Rösti night" }],
};
