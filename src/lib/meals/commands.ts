import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Meal command returned an unexpected payload");
}

export type PlaceMealInput = {
  householdId?: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | null;
  sourceKind: "library" | "freeform" | "leftover";
  idempotencyKey: string;
  mealDefinitionId?: string | null;
  leftoverOfEntryId?: string | null;
  title?: string | null;
  recipeUrl?: string | null;
  notes?: string | null;
};

export async function placeMeal(
  input: PlaceMealInput,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("place_meal", {
    p_household_id: input.householdId ?? member.householdId,
    p_date: input.date,
    p_slot: input.slot,
    p_source_kind: input.sourceKind,
    p_idempotency_key: input.idempotencyKey,
    p_meal_definition_id: input.mealDefinitionId ?? null,
    p_leftover_of_entry_id: input.leftoverOfEntryId ?? null,
    p_title: input.title ?? null,
    p_recipe_url: input.recipeUrl ?? null,
    p_notes: input.notes ?? null,
  });

  if (error) {
    throw new Error(`place_meal failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function moveMealPlanEntry(input: {
  entryId: string;
  date: string;
  slot: "breakfast" | "lunch" | "dinner" | null;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("move_meal_plan_entry", {
    p_entry_id: input.entryId,
    p_date: input.date,
    p_slot: input.slot,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`move_meal_plan_entry failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function removeMealPlanEntry(input: {
  entryId: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_meal_plan_entry", {
    p_entry_id: input.entryId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`remove_meal_plan_entry failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function createMealPreparation(input: {
  mealPlanEntryId: string;
  title: string;
  instructions?: string | null;
  dueOn: string;
  areaId: string;
  assignmentPolicy: "assigned" | "alternating" | "shared";
  assignedMemberId?: string | null;
  rotationAnchorMemberId?: string | null;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_meal_preparation", {
    p_meal_plan_entry_id: input.mealPlanEntryId,
    p_title: input.title,
    p_instructions: input.instructions ?? null,
    p_due_on: input.dueOn,
    p_area_id: input.areaId,
    p_assignment_policy: input.assignmentPolicy,
    p_assigned_member_id: input.assignedMemberId ?? null,
    p_rotation_anchor_member_id: input.rotationAnchorMemberId ?? null,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`create_meal_preparation failed: ${error.message}`);
  }

  return asRecord(data);
}
