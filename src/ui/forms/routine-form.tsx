"use client";
import { useState } from "react";

import type { FormAction } from "@/lib/forms/action-state";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields, FormSection } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
import {
  RoutineResponsibilityFields,
  type AssignmentPolicy,
} from "@/ui/forms/routine-responsibility-fields.client";
import {
  RoutineScheduleFields,
  type ScheduleMode,
} from "@/ui/forms/routine-schedule-fields.client";

type Option = { id: string; name: string };
type Member = { user_id: string; display_name: string };
export type RoutineFormDefaults = {
  routineId?: string;
  expectedUpdatedAt?: string;
  idempotencyKey?: string;
  title?: string;
  instructions?: string | null;
  areaId?: string;
  petId?: string | null;
  assignmentPolicy?: AssignmentPolicy;
  memberId?: string | null;
  priority?: "pet_care" | "meal_deadline" | "cleaning" | "general";
  scheduleMode?: ScheduleMode;
  scheduleRule?: Record<string, unknown>;
};

function RoutineDetails({
  areas,
  defaults,
  pets,
}: {
  areas: readonly Option[];
  defaults: RoutineFormDefaults;
  pets: readonly Option[];
}) {
  return (
    <FormSection legend="Details">
      <FormField
        label="Instructions"
        description="Details both members can see."
        optional
      >
        <EchoedTextarea
          initialValue={defaults.instructions ?? ""}
          maxLength={4000}
          name="instructions"
        />
      </FormField>
      <FormField label="Area">
        <EchoedSelect
          initialValue={
            defaults.areaId ??
            areas.find((area) => area.name === "General")?.id ??
            areas[0]?.id ??
            ""
          }
          items={areas.map((area) => ({
            label: area.name,
            value: area.id,
          }))}
          name="areaId"
          required
        />
      </FormField>
      <FormField
        label="Pet"
        description="Only pet care routines need one."
        optional
      >
        <EchoedSelect
          initialValue={defaults.petId ?? ""}
          items={[
            { label: "No pet", value: "" },
            ...pets.map((pet) => ({
              label: pet.name,
              value: pet.id,
            })),
          ]}
          name="petId"
        />
      </FormField>
      <FormField label="Priority">
        <EchoedSelect
          initialValue={defaults.priority ?? "general"}
          items={[
            { label: "General", value: "general" },
            { label: "Cleaning", value: "cleaning" },
            { label: "Meal deadline", value: "meal_deadline" },
            { label: "Pet care", value: "pet_care" },
          ]}
          name="priority"
        />
      </FormField>
    </FormSection>
  );
}

type RoutineFormProps = {
  action: FormAction;
  areas: readonly Option[];
  defaultDate: string;
  defaults?: RoutineFormDefaults;
  members: readonly Member[];
  pets: readonly Option[];
  submitLabel: string;
};
export function RoutineForm(props: RoutineFormProps) {
  return (
    <RoutineFormSession key={props.defaults?.routineId ?? "new"} {...props} />
  );
}
function RoutineFormSession({
  action,
  areas,
  defaultDate: initialDate,
  defaults: initialDefaults = {},
  members,
  pets,
  submitLabel,
}: RoutineFormProps) {
  const [{ defaults, defaultDate }] = useState({
    defaults: initialDefaults,
    defaultDate: initialDate,
  });
  return (
    <FormFields
      protectChanges
      action={action}
      submitLabel={submitLabel}
      showRequiredNotice={false}
    >
      {defaults.routineId ? (
        <>
          <input name="routineId" type="hidden" value={defaults.routineId} />
          <input
            name="expectedUpdatedAt"
            type="hidden"
            value={defaults.expectedUpdatedAt ?? ""}
          />
          <input
            name="idempotencyKey"
            type="hidden"
            value={defaults.idempotencyKey ?? ""}
          />
        </>
      ) : null}
      <FormSection legend="What needs doing?">
        <FormField label="Title">
          <EchoedInput
            initialValue={defaults.title}
            maxLength={120}
            name="title"
            required
          />
        </FormField>
      </FormSection>
      <RoutineResponsibilityFields
        defaultMemberId={defaults.memberId ?? null}
        defaultPolicy={defaults.assignmentPolicy ?? "shared"}
        members={members}
      />
      <RoutineScheduleFields
        defaultDate={defaultDate}
        defaultMode={defaults.scheduleMode ?? "one_off"}
        rule={defaults.scheduleRule ?? {}}
      />
      <details
        className="group border-t pt-4"
        open={Boolean(defaults.instructions || defaults.petId)}
      >
        <summary className="min-h-11 cursor-pointer font-medium">
          Area, instructions & more
        </summary>
        <RoutineDetails areas={areas} defaults={defaults} pets={pets} />
      </details>
    </FormFields>
  );
}
