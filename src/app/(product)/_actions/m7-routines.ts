"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  echoValues,
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { requireMemberContext } from "@/lib/auth/member-context";
import { errorField } from "@/lib/forms/field-error";
import {
  formErrorMessage,
  parseRoutineForm,
  routineFormChangesSchedule,
} from "@/lib/forms/m7";
import {
  createRoutine,
  updateRoutineDefinition,
} from "@/lib/routines/commands";
import { createClient } from "@/lib/supabase/server";
import type { FormActionResult } from "@/ui/forms/form-action";

const routineEchoNames = [
  "title",
  "instructions",
  "areaId",
  "petId",
  "priority",
  "assignmentPolicy",
  "memberId",
  "scheduleMode",
  "oneOffDate",
  "weeklyWeekday",
  "monthlyDay",
  "intervalEvery",
  "intervalUnit",
] as const;

export async function createRoutineAction(
  formData: FormData,
): Promise<FormActionResult> {
  let failure: unknown = null;
  try {
    await createRoutine(parseRoutineForm(formData));
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return {
      error: formErrorMessage(failure),
      field: errorField(failure),
      values: echoValues(formData, routineEchoNames),
    };
  }
  revalidateProduct(["/", "/home"]);
  redirect("/home");
}

export async function updateRoutineAction(
  formData: FormData,
): Promise<FormActionResult> {
  let failure: unknown = null;
  try {
    const routineId = uuidSchema.parse(formData.get("routineId"));
    const parsed = parseRoutineForm(formData);
    const member = await requireMemberContext();
    const supabase = await createClient();
    const current = await supabase
      .from("routines")
      .select(
        "schedule_kind, schedule_rule, assignment_policy, assigned_member_id, rotation_anchor_member_id",
      )
      .eq("household_id", member.householdId)
      .eq("id", routineId)
      .maybeSingle();
    if (current.error) {
      throw new Error(`routine lookup failed: ${current.error.message}`);
    }
    if (current.data === null) {
      throw new Error("That routine is no longer available.");
    }
    const stored = z
      .object({
        schedule_kind: z.enum(["one_off", "calendar", "after_completion"]),
        schedule_rule: z.unknown(),
        assignment_policy: z.enum(["assigned", "alternating", "shared"]),
        assigned_member_id: z.string().uuid().nullable(),
        rotation_anchor_member_id: z.string().uuid().nullable(),
      })
      .parse(current.data);
    await updateRoutineDefinition({
      routineId,
      ...parsed,
      rebuildWindow: routineFormChangesSchedule(
        {
          scheduleKind: stored.schedule_kind,
          scheduleRule: stored.schedule_rule,
          assignmentPolicy: stored.assignment_policy,
          assignedMemberId: stored.assigned_member_id,
          rotationAnchorMemberId: stored.rotation_anchor_member_id,
        },
        parsed,
      ),
    });
  } catch (error) {
    failure = error;
  }
  if (failure !== null) {
    return {
      error: formErrorMessage(failure),
      field: errorField(failure),
      values: echoValues(formData, routineEchoNames),
    };
  }
  revalidateProduct(["/", "/home"]);
  redirect("/home");
}
