import { notFound } from "next/navigation";
import { z } from "zod";

import { updateRoutineAction } from "@/app/(product)/_actions/m7-routines";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadRoutineFormOptions } from "@/lib/forms/options";
import { createClient } from "@/lib/supabase/server";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RoutineForm } from "@/ui/forms/routine-form";

const routineSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  instructions: z.string().nullable(),
  area_id: z.string().uuid(),
  pet_id: z.string().uuid().nullable(),
  assignment_policy: z.enum(["assigned", "alternating", "shared"]),
  assigned_member_id: z.string().uuid().nullable(),
  rotation_anchor_member_id: z.string().uuid().nullable(),
  schedule_rule: z.record(z.string(), z.unknown()),
  priority: z.enum(["pet_care", "meal_deadline", "cleaning", "general"]),
});

function scheduleMode(rule: Record<string, unknown>) {
  return z
    .enum([
      "one_off",
      "daily",
      "weekdays",
      "weekly",
      "monthly",
      "after_completion",
    ])
    .parse(rule.kind);
}

export default async function EditRoutinePage({
  params,
}: {
  params: Promise<{ routineId: string }>;
}) {
  const [{ routineId }, member, options] = await Promise.all([
    params,
    requireMemberContext(),
    loadRoutineFormOptions(),
  ]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("routines")
    .select(
      "id, title, instructions, area_id, pet_id, assignment_policy, assigned_member_id, rotation_anchor_member_id, schedule_rule, priority",
    )
    .eq("household_id", member.householdId)
    .eq("id", routineId)
    .is("archived_at", null)
    .maybeSingle();
  if (error) throw new Error(`routine edit lookup failed: ${error.message}`);
  if (data === null) notFound();
  const routine = routineSchema.parse(data);
  return (
    <FormPage
      backHref="/home"
      description="Update the definition; existing completion history remains intact."
      title="Edit routine"
    >
      <RoutineForm
        action={updateRoutineAction}
        areas={options.areas}
        defaultDate={zurichCivilDate()}
        defaults={{
          routineId: routine.id,
          title: routine.title,
          instructions: routine.instructions,
          areaId: routine.area_id,
          petId: routine.pet_id,
          assignmentPolicy: routine.assignment_policy,
          memberId:
            routine.assigned_member_id ?? routine.rotation_anchor_member_id,
          priority: routine.priority,
          scheduleMode: scheduleMode(routine.schedule_rule),
          scheduleRule: routine.schedule_rule,
        }}
        members={options.members}
        pets={options.pets}
        submitLabel="Save routine"
      />
    </FormPage>
  );
}
