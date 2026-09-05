import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import type { parseMealPreparationEdit } from "@/lib/forms/meal-preparation";

const prepSchema = z.object({
  id: z.string().uuid(),
  routine_id: z.string().uuid(),
  due_date: z.string(),
  status: z.enum(["open", "completed", "skipped"]),
  planned_assignee_id: z.string().uuid().nullable(),
  routine: z.object({
    updated_at: z.string(),
    title: z.string(),
    instructions: z.string().nullable(),
    area_id: z.string().uuid(),
    schedule_rule: z.object({ kind: z.literal("one_off"), date: z.string() }),
  }),
});
export async function loadMealPreparation(entryId: string) {
  const member = await requireMemberContext();
  const client = await createClient();
  const { data, error } = await client
    .from("routine_occurrences")
    .select(
      "id, routine_id, due_date, status, planned_assignee_id, routine:routines!inner(updated_at, title, instructions, area_id, schedule_rule)",
    )
    .eq("household_id", member.householdId)
    .eq("meal_plan_entry_id", z.string().uuid().parse(entryId))
    .maybeSingle();
  if (error) throw new Error("Could not load this meal’s preparation task.");
  return data ? prepSchema.parse(data) : null;
}
export type MealPreparation = NonNullable<
  Awaited<ReturnType<typeof loadMealPreparation>>
>;

export async function updateMealPreparation(
  input: ReturnType<typeof parseMealPreparationEdit>,
) {
  const prep = await loadMealPreparation(input.entryId);
  if (!prep) throw new Error("This meal no longer has a preparation task.");
  const client = await createClient();
  const { error } = await client.rpc("edit_routine_definition", {
    p_routine_id: prep.routine_id,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_idempotency_key: input.idempotencyKey,
    p_patch: {
      title: input.title,
      instructions: input.instructions,
      area_id: input.areaId,
      ...(input.dueOn !== input.originalDueOn
        ? {
            schedule_kind: "one_off",
            schedule_rule: { kind: "one_off", date: input.dueOn },
          }
        : {}),
      assignment_policy: input.assignedMemberId ? "assigned" : "shared",
      assigned_member_id: input.assignedMemberId,
      rotation_anchor_member_id: null,
    },
  });
  if (error?.code === "40001")
    throw new Error("This prep task changed. Reopen it before saving.");
  if (error)
    throw new Error(
      "Could not update this prep task. It may have just been completed. Refresh and try again.",
    );
}
