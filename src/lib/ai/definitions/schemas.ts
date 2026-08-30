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

/** Per-member shares may legitimately be zero (a 100/0 split). */
export const allocationCentimes = z
  .number()
  .int()
  .min(0)
  .describe("Member share in integer centimes; zero is allowed");

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

/** Recipe links match the meal form's boundary: web URLs only. */
export const webUrl = z.url({ protocol: /^https?$/ }).describe("http(s) URL");

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
      days: z
        .array(isoWeekday)
        .min(1)
        .max(7)
        .refine((days) => new Set(days).size === days.length, {
          message: "weekdays must be unique",
        }),
    }),
    z.object({ kind: z.literal("weekly"), weekday: isoWeekday }),
    z.object({ kind: z.literal("biweekly"), weekday: isoWeekday }),
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
    "When the routine recurs. one_off happens once on a date; daily/weekdays/weekly/biweekly/monthly follow the calendar; after_completion re-arms a fixed interval after each completion.",
  );

export const expenseSplitSchema = z
  .discriminatedUnion("kind", [
    z.object({ kind: z.literal("equal") }),
    z.object({
      kind: z.literal("custom"),
      allocations: z
        .array(z.object({ memberId: uuid, allocatedCents: allocationCentimes }))
        .length(2),
    }),
  ])
  .describe(
    "How the amount is shared. equal splits it evenly (odd centime goes to the payer); custom allocations must cover both members and sum to the amount.",
  );

type SplitLike =
  | {
      kind: string;
      allocations?: readonly { memberId: string; allocatedCents: number }[];
    }
  | null
  | undefined;

/**
 * Cross-field rule a custom split must satisfy against its amount, so
 * invalid proposals die at validation instead of after the member approves
 * them. Returns the problem, or null when the split is valid or not custom.
 */
export function splitAmountIssue(
  split: SplitLike,
  amountCents: number,
): string | null {
  if (split == null || split.kind !== "custom" || !split.allocations) {
    return null;
  }
  const [first, second] = split.allocations;
  if (first === undefined || second === undefined) {
    return null;
  }
  if (first.memberId === second.memberId) {
    return "custom allocations must name two different members";
  }
  if (first.allocatedCents + second.allocatedCents !== amountCents) {
    return "custom allocations must sum to amountCents";
  }
  return null;
}

/** Attaches the custom-split rule to a schema with amountCents + split. */
export function withSplitAmountCheck<
  T extends z.ZodType<{
    amountCents: number;
    split?: SplitLike;
  }>,
>(schema: T): T {
  return schema.superRefine((value, ctx) => {
    const issue = splitAmountIssue(value.split, value.amountCents);
    if (issue !== null) {
      ctx.addIssue({ code: "custom", message: issue, path: ["split"] });
    }
  }) as T;
}

type AssignmentLike = {
  assignmentPolicy?: string | null;
  assignedMemberId?: string | null;
  rotationAnchorMemberId?: string | null;
};

/** The pairing rule the routine RPCs enforce; fail it at validation. */
export function assignmentIssue(value: AssignmentLike): string | null {
  const policy = value.assignmentPolicy;
  if (policy == null) {
    return null;
  }
  if (policy === "assigned" && value.assignedMemberId == null) {
    return "assignmentPolicy assigned requires assignedMemberId";
  }
  if (policy === "alternating" && value.rotationAnchorMemberId == null) {
    return "assignmentPolicy alternating requires rotationAnchorMemberId";
  }
  if (
    policy === "shared" &&
    (value.assignedMemberId != null || value.rotationAnchorMemberId != null)
  ) {
    return "assignmentPolicy shared takes no member ids";
  }
  return null;
}

/** Attaches the assignment pairing rule to a schema carrying the fields. */
export function withAssignmentCheck<T extends z.ZodType<AssignmentLike>>(
  schema: T,
): T {
  return schema.superRefine((value, ctx) => {
    const issue = assignmentIssue(value);
    if (issue !== null) {
      ctx.addIssue({
        code: "custom",
        message: issue,
        path: ["assignmentPolicy"],
      });
    }
  }) as T;
}

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
