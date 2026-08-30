import { z } from "zod";

import { scheduleInputSchema } from "@/lib/ai/definitions";

export type AiScheduleInput = z.infer<typeof scheduleInputSchema>;

/**
 * Maps the assistant's single `schedule` union onto the routine engine's
 * split representation (schedule_kind column + schedule_rule jsonb).
 */
export function toRoutineSchedule(schedule: AiScheduleInput): {
  scheduleKind: "one_off" | "calendar" | "after_completion";
  scheduleRule: Record<string, unknown>;
} {
  switch (schedule.kind) {
    case "one_off":
      return {
        scheduleKind: "one_off",
        scheduleRule: { kind: "one_off", date: schedule.date },
      };
    case "after_completion":
      return {
        scheduleKind: "after_completion",
        scheduleRule: {
          kind: "after_completion",
          every: schedule.every,
          unit: schedule.unit,
        },
      };
    default:
      return {
        scheduleKind: "calendar",
        scheduleRule: schedule as unknown as Record<string, unknown>,
      };
  }
}
