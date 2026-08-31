import "server-only";

import { windowIssue } from "@/lib/ai/definitions/schemas";
import { toRoutineSchedule, type AiScheduleInput } from "@/lib/ai/schedule";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  archiveRoutine,
  completeOccurrence,
  createRoutine,
  pauseRoutine,
  rescheduleOccurrence,
  skipOccurrence,
  unpauseRoutine,
  updateRoutineDefinition,
} from "@/lib/routines/commands";

type AssignmentPolicy = "assigned" | "alternating" | "shared";
type Priority = "pet_care" | "meal_deadline" | "cleaning" | "general";

/** Stored fields whose RPC parameters are pairwise-coupled. */
async function readRoutineSnapshot(routineId: string): Promise<{
  activeFrom: string | null;
  activeUntil: string | null;
  areaId: string;
  petId: string | null;
}> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select("active_from, active_until, area_id, pet_id")
    .eq("household_id", member.householdId)
    .eq("id", routineId)
    .single();
  if (error !== null) {
    throw new Error(`routine lookup failed: ${error.message}`);
  }
  const row = data as {
    active_from: string | null;
    active_until: string | null;
    area_id: string;
    pet_id: string | null;
  };
  return {
    activeFrom: row.active_from,
    activeUntil: row.active_until,
    areaId: row.area_id,
    petId: row.pet_id,
  };
}

type RoutineUpdateValue = {
  routineId: string;
  areaId?: string | null;
  petId?: string | null;
  activeFrom?: string | null;
  activeUntil?: string | null;
};

/**
 * The RPC couples its parameters: the window writes both boundaries when
 * either is provided, and a non-null area with a null pet clears the pet.
 * Fill the side the model omitted from the stored routine so partial
 * updates stay partial, while explicit nulls still clear.
 */
async function resolveRoutinePatch(value: RoutineUpdateValue): Promise<{
  activeFrom: string | null;
  activeUntil: string | null;
  areaId: string | null;
  petId: string | null | undefined;
}> {
  const windowTouched =
    value.activeFrom !== undefined || value.activeUntil !== undefined;
  const petAtRisk = value.areaId != null && value.petId === undefined;
  const petClearNeedsArea = value.petId === null && value.areaId == null;
  if (!windowTouched && !petAtRisk && !petClearNeedsArea) {
    return {
      activeFrom: null,
      activeUntil: null,
      areaId: value.areaId ?? null,
      petId: value.petId,
    };
  }
  const current = await readRoutineSnapshot(value.routineId);
  const activeFrom = !windowTouched
    ? null
    : value.activeFrom === undefined
      ? current.activeFrom
      : value.activeFrom;
  const activeUntil = !windowTouched
    ? null
    : value.activeUntil === undefined
      ? current.activeUntil
      : value.activeUntil;
  // The RPC reads an all-null window pair as "keep both", so a clear that
  // resolves to two nulls would silently succeed without clearing; the
  // database cannot express it in one call.
  if (
    windowTouched &&
    activeFrom === null &&
    activeUntil === null &&
    (value.activeFrom === null || value.activeUntil === null)
  ) {
    throw new Error(
      "clearing this window is not supported in one step: set activeFrom to a date in the same call, or clear the boundaries in separate calls while one keeps a date",
    );
  }
  const orderingIssue = windowIssue({ activeFrom, activeUntil });
  if (orderingIssue !== null) {
    throw new Error(orderingIssue);
  }
  return {
    activeFrom,
    activeUntil,
    areaId: petClearNeedsArea ? current.areaId : (value.areaId ?? null),
    petId: petAtRisk ? current.petId : value.petId,
  };
}

export const ROUTINE_HANDLERS: Record<string, AiWriteHandler> = {
  create_routine: (input, { today }) => {
    const value = input as {
      title: string;
      areaId: string;
      schedule: AiScheduleInput;
      assignmentPolicy: AssignmentPolicy;
      assignedMemberId?: string | null;
      rotationAnchorMemberId?: string | null;
      priority: Priority;
      instructions?: string | null;
      petId?: string | null;
      activeFrom?: string | null;
      activeUntil?: string | null;
    };
    const activeFrom = value.activeFrom ?? today;
    const createIssue = windowIssue({
      activeFrom,
      activeUntil: value.activeUntil,
    });
    if (createIssue !== null) {
      throw new Error(createIssue);
    }
    return createRoutine({
      title: value.title,
      areaId: value.areaId,
      ...toRoutineSchedule(value.schedule),
      assignmentPolicy: value.assignmentPolicy,
      assignedMemberId: value.assignedMemberId ?? null,
      rotationAnchorMemberId: value.rotationAnchorMemberId ?? null,
      priority: value.priority,
      instructions: value.instructions ?? null,
      petId: value.petId ?? null,
      activeFrom,
      activeUntil: value.activeUntil ?? null,
    });
  },
  update_routine: async (input) => {
    const value = input as {
      routineId: string;
      title?: string | null;
      schedule?: AiScheduleInput | null;
      assignmentPolicy?: AssignmentPolicy | null;
      assignedMemberId?: string | null;
      rotationAnchorMemberId?: string | null;
      priority?: Priority | null;
      instructions?: string | null;
      areaId?: string | null;
      petId?: string | null;
      activeFrom?: string | null;
      activeUntil?: string | null;
    };
    const schedule = value.schedule ? toRoutineSchedule(value.schedule) : null;
    const patch = await resolveRoutinePatch(value);
    // instructions pass through untouched: omitted (undefined) keeps the
    // stored value, explicit null clears it.
    return updateRoutineDefinition({
      routineId: value.routineId,
      title: value.title ?? null,
      instructions: value.instructions,
      areaId: patch.areaId,
      petId: patch.petId,
      assignmentPolicy: value.assignmentPolicy ?? null,
      assignedMemberId: value.assignedMemberId ?? null,
      rotationAnchorMemberId: value.rotationAnchorMemberId ?? null,
      scheduleKind: schedule?.scheduleKind ?? null,
      scheduleRule: schedule?.scheduleRule ?? null,
      priority: value.priority ?? null,
      activeFrom: patch.activeFrom,
      activeUntil: patch.activeUntil,
    });
  },
  pause_routine: (input) =>
    pauseRoutine((input as { routineId: string }).routineId),
  unpause_routine: (input) =>
    unpauseRoutine((input as { routineId: string }).routineId),
  archive_routine: (input) =>
    archiveRoutine((input as { routineId: string }).routineId),
  complete_occurrence: (input, { today }) => {
    const value = input as { occurrenceId: string; note?: string | null };
    return completeOccurrence({
      occurrenceId: value.occurrenceId,
      idempotencyKey: `complete-occurrence:${value.occurrenceId}`,
      completedOn: today,
      note: value.note ?? null,
    });
  },
  skip_occurrence: (input) => {
    const value = input as { occurrenceId: string };
    return skipOccurrence({
      occurrenceId: value.occurrenceId,
      idempotencyKey: `skip-occurrence:${value.occurrenceId}`,
    });
  },
  reschedule_occurrence: (input, { idempotencyKey }) => {
    const value = input as { occurrenceId: string; newDueDate: string };
    return rescheduleOccurrence({
      occurrenceId: value.occurrenceId,
      newDueDate: value.newDueDate,
      idempotencyKey,
    });
  },
};
