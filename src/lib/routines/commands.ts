import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export type CreateRoutineInput = {
  title: string;
  areaId: string;
  assignmentPolicy: "assigned" | "alternating" | "shared";
  scheduleKind: "one_off" | "calendar" | "after_completion";
  scheduleRule: Record<string, unknown>;
  priority?: "pet_care" | "meal_deadline" | "cleaning" | "general";
  instructions?: string | null;
  petId?: string | null;
  assignedMemberId?: string | null;
  rotationAnchorMemberId?: string | null;
  activeFrom?: string | null;
  activeUntil?: string | null;
};

export type CompleteOccurrenceInput = {
  occurrenceId: string;
  idempotencyKey: string;
  completedOn: string;
  note?: string | null;
  photoPath?: string | null;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  throw new Error("Routine command returned an unexpected payload");
}

export async function createRoutine(
  input: CreateRoutineInput,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_routine", {
    p_household_id: member.householdId,
    p_title: input.title,
    p_area_id: input.areaId,
    p_assignment_policy: input.assignmentPolicy,
    p_schedule_kind: input.scheduleKind,
    p_schedule_rule: input.scheduleRule,
    p_assigned_member_id: input.assignedMemberId ?? null,
    p_rotation_anchor_member_id: input.rotationAnchorMemberId ?? null,
    p_instructions: input.instructions ?? null,
    p_pet_id: input.petId ?? null,
    p_priority: input.priority ?? "general",
    p_active_from: input.activeFrom ?? null,
    p_active_until: input.activeUntil ?? null,
  });

  if (error) {
    throw new Error(`create_routine failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function completeOccurrence(
  input: CompleteOccurrenceInput,
): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_occurrence", {
    p_occurrence_id: input.occurrenceId,
    p_idempotency_key: input.idempotencyKey,
    p_completed_on: input.completedOn,
    p_note: input.note ?? null,
    p_photo_path: input.photoPath ?? null,
  });

  if (error) {
    throw new Error(`complete_occurrence failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function skipOccurrence(input: {
  occurrenceId: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("skip_occurrence", {
    p_occurrence_id: input.occurrenceId,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`skip_occurrence failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function rescheduleOccurrence(input: {
  occurrenceId: string;
  newDueDate: string;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reschedule_occurrence", {
    p_occurrence_id: input.occurrenceId,
    p_new_due_date: input.newDueDate,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`reschedule_occurrence failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function pauseRoutine(
  routineId: string,
): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("pause_routine", {
    p_routine_id: routineId,
  });

  if (error) {
    throw new Error(`pause_routine failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function unpauseRoutine(
  routineId: string,
): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("unpause_routine", {
    p_routine_id: routineId,
  });

  if (error) {
    throw new Error(`unpause_routine failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function archiveRoutine(
  routineId: string,
): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("archive_routine", {
    p_routine_id: routineId,
  });

  if (error) {
    throw new Error(`archive_routine failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function updateRoutineDefinition(input: {
  routineId: string;
  title?: string | null;
  instructions?: string | null;
  areaId?: string | null;
  petId?: string | null;
  assignmentPolicy?: "assigned" | "alternating" | "shared" | null;
  assignedMemberId?: string | null;
  rotationAnchorMemberId?: string | null;
  scheduleKind?: "one_off" | "calendar" | "after_completion" | null;
  scheduleRule?: Record<string, unknown> | null;
  priority?: "pet_care" | "meal_deadline" | "cleaning" | "general" | null;
  activeFrom?: string | null;
  activeUntil?: string | null;
  rebuildWindow?: boolean;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_routine_definition", {
    p_routine_id: input.routineId,
    p_title: input.title ?? null,
    p_instructions: input.instructions ?? null,
    p_area_id: input.areaId ?? null,
    p_pet_id: input.petId ?? null,
    p_assignment_policy: input.assignmentPolicy ?? null,
    p_assigned_member_id: input.assignedMemberId ?? null,
    p_rotation_anchor_member_id: input.rotationAnchorMemberId ?? null,
    p_schedule_kind: input.scheduleKind ?? null,
    p_schedule_rule: input.scheduleRule ?? null,
    p_priority: input.priority ?? null,
    p_active_from: input.activeFrom ?? null,
    p_active_until: input.activeUntil ?? null,
    p_rebuild_window: input.rebuildWindow ?? true,
  });

  if (error) {
    throw new Error(`update_routine_definition failed: ${error.message}`);
  }

  // Unlike the RPC's coalescing parameters, this table update writes what it
  // is given: undefined keeps the stored value, an explicit null clears it.
  const optionalPatch: { instructions?: string | null; pet_id?: string | null } =
    {};
  if (input.instructions !== undefined) {
    optionalPatch.instructions = input.instructions;
  }
  if (input.petId !== undefined) {
    optionalPatch.pet_id = input.petId;
  }
  if (Object.keys(optionalPatch).length > 0) {
    const { error: optionalFieldsError } = await supabase
      .from("routines")
      .update(optionalPatch)
      .eq("household_id", member.householdId)
      .eq("id", input.routineId);

    if (optionalFieldsError) {
      throw new Error(
        `update_routine_optional_fields failed: ${optionalFieldsError.message}`,
      );
    }
  }

  return asRecord(data);
}
