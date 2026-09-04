"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import {
  revalidateProduct,
  uuidSchema,
} from "@/app/(product)/_actions/m7-shared";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  parseRoutineForm,
  routineFormChangesSchedule,
} from "@/lib/forms/routine";
import {
  createRoutine,
  pauseRoutine,
  unpauseRoutine,
  archiveRoutine,
  updateRoutineDefinition,
} from "@/lib/routines/commands";
import { createClient } from "@/lib/supabase/server";

export async function createRoutineAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    await createRoutine(parseRoutineForm(formData));
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}

export async function updateRoutineAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
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
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}

export async function routineLifecycleAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const routineId = uuidSchema.parse(formData.get("routineId"));
    const intent = z
      .enum(["pause", "resume", "archive"])
      .parse(formData.get("intent"));
    if (intent === "pause") await pauseRoutine(routineId);
    if (intent === "resume") await unpauseRoutine(routineId);
    if (intent === "archive") await archiveRoutine(routineId);
  });
  if (rejected) return rejected;
  revalidateProduct(["/", "/home"]);
  redirect("/home?saved=routine");
}
