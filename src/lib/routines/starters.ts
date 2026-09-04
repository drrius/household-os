export const ROUTINE_STARTERS = [
  {
    id: "kitchen",
    title: "Reset the kitchen",
    area: "Kitchen",
    description: "Clear the counters and leave the sink ready for tomorrow.",
    scheduleMode: "daily",
    scheduleRule: { kind: "daily" },
    priority: "cleaning",
  },
  {
    id: "floors",
    title: "Vacuum the floors",
    area: "Cleaning",
    description: "A weekly reset for the rooms you use most.",
    scheduleMode: "weekly",
    scheduleRule: { kind: "weekly", weekday: 6 },
    priority: "cleaning",
  },
  {
    id: "bathroom",
    title: "Clean the bathroom",
    area: "Cleaning",
    description:
      "Sink, toilet, and shower — adapt the instructions to your home.",
    scheduleMode: "weekly",
    scheduleRule: { kind: "weekly", weekday: 6 },
    priority: "cleaning",
  },
  {
    id: "sheets",
    title: "Change the bed linen",
    area: "Laundry",
    description: "Fresh sheets every other Sunday.",
    scheduleMode: "biweekly",
    scheduleRule: { kind: "biweekly", weekday: 7 },
    priority: "cleaning",
  },
  {
    id: "laundry",
    title: "Do a load of laundry",
    area: "Laundry",
    description:
      "Every few days after the last load, rather than a fixed weekday.",
    scheduleMode: "after_completion",
    scheduleRule: { kind: "after_completion", every: 3, unit: "days" },
    priority: "general",
  },
  {
    id: "plants",
    title: "Check the plants",
    area: "General",
    description:
      "Check the soil before watering. Each plant has its own needs.",
    scheduleMode: "weekly",
    scheduleRule: { kind: "weekly", weekday: 7 },
    priority: "general",
  },
] as const;

export function findRoutineStarter(id: string | undefined) {
  return ROUTINE_STARTERS.find((starter) => starter.id === id);
}
