import { z } from "zod";

import {
  assignmentFields,
  assignmentPolicy,
  isoDate,
  routinePriority,
  scheduleInputSchema,
  uuid,
  withAssignmentCheck,
  type AiToolDefinition,
} from "@/lib/ai/definitions/schemas";

export const ROUTINE_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "create_routine",
    kind: "write",
    description:
      "Create a recurring or one-off household routine. Needs an area id (see get_household). Pet-care routines should reference the pet and use priority pet_care.",
    inputSchema: withAssignmentCheck(
      z.object({
        title: z.string().trim().min(1).max(120),
        areaId: uuid,
        schedule: scheduleInputSchema,
        ...assignmentFields,
        priority: routinePriority.optional().default("general"),
        instructions: z.string().max(2000).nullish(),
        petId: uuid.nullish(),
        activeFrom: isoDate
          .nullish()
          .describe("First day the routine is active; defaults to today"),
        activeUntil: isoDate.nullish(),
      }),
    ),
  },
  {
    name: "update_routine",
    kind: "write",
    description:
      "Change a routine's title, schedule, assignment, priority, instructions, area, pet, or activity window. Only provided fields change; omitted fields keep their current values, and passing null for instructions or petId clears them.",
    inputSchema: withAssignmentCheck(
      z.object({
        routineId: uuid,
        title: z.string().trim().min(1).max(120).nullish(),
        schedule: scheduleInputSchema.nullish(),
        assignmentPolicy: assignmentPolicy.nullish(),
        assignedMemberId: uuid.nullish(),
        rotationAnchorMemberId: uuid.nullish(),
        priority: routinePriority.nullish(),
        instructions: z.string().max(2000).nullish(),
        areaId: uuid.nullish(),
        petId: uuid.nullish(),
        activeFrom: isoDate.nullish(),
        activeUntil: isoDate.nullish(),
      }),
    ),
  },
  {
    name: "pause_routine",
    kind: "write",
    description: "Pause a routine so it stops generating occurrences.",
    inputSchema: z.object({ routineId: uuid }),
  },
  {
    name: "unpause_routine",
    kind: "write",
    description: "Resume a paused routine.",
    inputSchema: z.object({ routineId: uuid }),
  },
  {
    name: "archive_routine",
    kind: "write",
    description:
      "Archive a routine permanently (history is kept; the routine stops). Prefer pause for temporary stops.",
    inputSchema: z.object({ routineId: uuid }),
  },
  {
    name: "complete_occurrence",
    kind: "write",
    description:
      "Mark an open routine occurrence as completed today, on behalf of the signed-in member.",
    inputSchema: z.object({
      occurrenceId: uuid,
      note: z.string().max(500).nullish(),
    }),
  },
  {
    name: "skip_occurrence",
    kind: "write",
    description:
      "Skip an open routine occurrence without completing it. The next occurrence is scheduled as usual.",
    inputSchema: z.object({ occurrenceId: uuid }),
  },
  {
    name: "reschedule_occurrence",
    kind: "write",
    description: "Move an open routine occurrence to a new due date.",
    inputSchema: z.object({ occurrenceId: uuid, newDueDate: isoDate }),
  },
];
