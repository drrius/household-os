import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { FormAction } from "@/ui/forms/form-action";
import {
  FormField,
  FormFields,
  FormSection,
  selectClassName,
} from "@/ui/forms/form-page";
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
    <FormSection legend="Routine">
      <FormField label="Title">
        <Input
          defaultValue={defaults.title}
          maxLength={120}
          name="title"
          required
        />
      </FormField>
      <FormField
        label="Instructions"
        description="Details both members can see."
        optional
      >
        <Textarea
          defaultValue={defaults.instructions ?? ""}
          maxLength={4000}
          name="instructions"
        />
      </FormField>
      <FormField label="Area">
        <select
          className={selectClassName}
          defaultValue={defaults.areaId ?? areas[0]?.id}
          name="areaId"
          required
        >
          {areas.map((area) => (
            <option key={area.id} value={area.id}>
              {area.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Pet"
        description="Only pet care routines need one."
        optional
      >
        <select
          className={selectClassName}
          defaultValue={defaults.petId ?? ""}
          name="petId"
        >
          <option value="">No pet</option>
          {pets.map((pet) => (
            <option key={pet.id} value={pet.id}>
              {pet.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Priority">
        <select
          className={selectClassName}
          defaultValue={defaults.priority ?? "general"}
          name="priority"
        >
          <option value="general">General</option>
          <option value="cleaning">Cleaning</option>
          <option value="meal_deadline">Meal deadline</option>
          <option value="pet_care">Pet care</option>
        </select>
      </FormField>
    </FormSection>
  );
}

export function RoutineForm({
  action,
  areas,
  defaultDate,
  defaults = {},
  members,
  pets,
  submitLabel,
}: {
  action: FormAction;
  areas: readonly Option[];
  defaultDate: string;
  defaults?: RoutineFormDefaults;
  members: readonly Member[];
  pets: readonly Option[];
  submitLabel: string;
}) {
  return (
    <FormFields action={action} submitLabel={submitLabel}>
      {defaults.routineId ? (
        <input name="routineId" type="hidden" value={defaults.routineId} />
      ) : null}
      <RoutineDetails areas={areas} defaults={defaults} pets={pets} />
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
    </FormFields>
  );
}
