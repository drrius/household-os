export type PlanSlot = {
  slot: "breakfast" | "lunch" | "dinner";
  entry: { id: string; title: string; isLeftover: boolean } | null;
};

export type PlanDay = {
  date: string;
  weekdayLabel: string;
  isToday: boolean;
  routines: { occurrenceId: string; title: string }[];
  slots: PlanSlot[];
};

export type PlanViewModel = {
  weekStart: string;
  weekEnd: string;
  rangeLabel: string;
  days: PlanDay[];
  library: { id: string; title: string }[];
};
