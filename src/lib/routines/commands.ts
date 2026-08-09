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
  firstDueOn?: string | null;
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
    p_first_due_on: input.firstDueOn ?? null,
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
