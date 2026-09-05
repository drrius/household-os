import { z } from "zod";
import { uuid, isoDate, type AiToolDefinition } from "./schemas";
export const dailyDetailSchemas = {
  get_meal_entry: z.object({ entryId: uuid }),
  get_routine_occurrence: z.object({ occurrenceId: uuid }),
  get_routine_history: z.object({
    routineId: uuid,
    page: z.number().int().min(0).max(10000).default(0),
  }),
  update_meal_preparation: z.object({
    entryId: uuid,
    expectedUpdatedAt: z.iso.datetime({ offset: true }),
    originalDueOn: isoDate,
    dueOn: isoDate,
    title: z.string().trim().min(1).max(120),
    instructions: z.string().trim().max(4000),
    areaId: uuid,
    assignedMemberId: uuid.nullable(),
  }),
  update_household_item: z.object({
    kind: z.enum(["area", "pet"]),
    id: uuid,
    name: z.string().trim().min(1).max(80),
  }),
  reorder_household_areas: z.object({
    ids: z
      .array(uuid)
      .max(1000)
      .refine(
        (ids) => new Set(ids).size === ids.length,
        "Area IDs must be unique",
      ),
  }),
};
const descriptions = {
  get_meal_entry:
    "Read one planned meal (including removed meals), its grocery connections and preparation task with edit version. Use the preparation routine's schedule_rule.date as originalDueOn when editing; the occurrence due_date may have been rescheduled separately.",
  get_routine_occurrence:
    "Read a routine occurrence's current status, assignment and completion note/photo metadata before acting. Photo metadata is not image contents.",
  get_routine_history:
    "Read paginated routine history, including current open and previous completed/skipped occurrences. Page is zero-based.",
  update_meal_preparation:
    "Edit a meal's preparation task using its current routine edit version. Read get_meal_entry first; preserve unchanged fields and original schedule date. Changes routine work only, never money.",
  update_household_item:
    "Rename an active area or pet found through get_household. Use only the real returned ID.",
  reorder_household_areas:
    "Set the complete active area order using IDs from get_household. Include every active area exactly once, in the requested order.",
};
export const DAILY_DETAIL_TOOLS: readonly AiToolDefinition[] = Object.entries(
  dailyDetailSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name.startsWith("get_") ? "read" : "write",
  description: descriptions[name as keyof typeof descriptions],
}));
