import "server-only";

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

/** Current activity window, so changing one boundary keeps the other. */
async function readRoutineWindow(
  routineId: string,
): Promise<{ activeFrom: string | null; activeUntil: string | null }> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select("active_from, active_until")
    .eq("household_id", member.householdId)
    .eq("id", routineId)
    .single();
  if (error !== null) {
    throw new Error(`routine lookup failed: ${error.message}`);
  }
  const row = data as {
    active_from: string | null;
    active_until: string | null;
  };
  return { activeFrom: row.active_from, activeUntil: row.active_until };
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
      activeFrom: value.activeFrom ?? today,
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
    // The RPC writes both window boundaries whenever either is provided,
    // so fill the omitted one from the stored routine.
    let activeFrom = value.activeFrom ?? null;
    let activeUntil = value.activeUntil ?? null;
    if (
      (value.activeFrom != null && value.activeUntil == null) ||
      (value.activeFrom == null && value.activeUntil != null)
    ) {
      const window = await readRoutineWindow(value.routineId);
      activeFrom = value.activeFrom ?? window.activeFrom;
      activeUntil = value.activeUntil ?? window.activeUntil;
    }
    // instructions/petId pass through untouched: omitted (undefined) keeps
    // the stored value, explicit null clears it.
    return updateRoutineDefinition({
      routineId: value.routineId,
      title: value.title ?? null,
      instructions: value.instructions,
      areaId: value.areaId ?? null,
      petId: value.petId,
      assignmentPolicy: value.assignmentPolicy ?? null,
      assignedMemberId: value.assignedMemberId ?? null,
      rotationAnchorMemberId: value.rotationAnchorMemberId ?? null,
      scheduleKind: schedule?.scheduleKind ?? null,
      scheduleRule: schedule?.scheduleRule ?? null,
      priority: value.priority ?? null,
      activeFrom,
      activeUntil,
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
