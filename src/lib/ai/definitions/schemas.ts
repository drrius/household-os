import { z } from "zod";

/**
 * Shared schema vocabulary for the assistant tool contract. Everything here
 * is pure and browser-safe; server execution lives in `src/lib/ai/execute`.
 */
export type AiToolKind = "read" | "write" | "financial";

export type AiToolDefinition = {
  name: string;
  description: string;
  kind: AiToolKind;
  inputSchema: z.ZodType;
};

export const uuid = z.uuid();

export const isoDate = z.iso
  .date()
  .describe("Civil date in Europe/Zurich as YYYY-MM-DD");

export const centimes = z
  .number()
  .int()
  .positive()
  .describe("CHF amount in integer centimes (CHF 12.50 = 1250)");

export const isoWeekday = z
  .union([
    z.literal(1),
    z.literal(2),
    z.literal(3),
    z.literal(4),
    z.literal(5),
    z.literal(6),
    z.literal(7),
  ])
  .describe("ISO weekday, Monday = 1 … Sunday = 7");

export const mealSlot = z.enum(["breakfast", "lunch", "dinner"]);

export const assignmentPolicy = z.enum(["assigned", "alternating", "shared"]);

export const routinePriority = z.enum([
  "pet_care",
  "meal_deadline",
  "cleaning",
  "general",
]);

export const scheduleInputSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("one_off"), date: isoDate }),
    z.object({ kind: z.literal("daily") }),
    z.object({
      kind: z.literal("weekdays"),
      days: z.array(isoWeekday).min(1).max(7),
    }),
    z.object({ kind: z.literal("weekly"), weekday: isoWeekday }),
    z.object({
      kind: z.literal("monthly"),
      dayOfMonth: z.number().int().min(1).max(31),
    }),
    z.object({
      kind: z.literal("after_completion"),
      every: z.number().int().min(1),
      unit: z.enum(["days", "weeks"]),
    }),
  ])
  .describe(
    "When the routine recurs. one_off happens once on a date; daily/weekdays/weekly/monthly follow the calendar; after_completion re-arms a fixed interval after each completion.",
  );

export const expenseSplitSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("equal") }),
    z.object({
      kind: z.literal("custom"),
      allocations: z
        .array(z.object({ memberId: uuid, allocatedCents: centimes }))
        .length(2),
    }),
  ])
  .describe(
    "How the amount is shared. equal splits it evenly (odd centime goes to the payer); custom allocations must cover both members and sum to the amount.",
  );

export const assignmentFields = {
  assignmentPolicy: assignmentPolicy.describe(
    "assigned = always the same member, alternating = members take turns, shared = either member",
  ),
  assignedMemberId: uuid
    .nullish()
    .describe("Required when assignmentPolicy is assigned"),
  rotationAnchorMemberId: uuid
    .nullish()
    .describe("Required when assignmentPolicy is alternating; who goes first"),
};
