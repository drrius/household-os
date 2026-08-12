import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormFields,
  FormSection,
  selectClassName,
} from "@/ui/forms/form-page";
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
  assignmentPolicy?: "assigned" | "alternating" | "shared";
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
        description="Optional details both members can see."
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
        description="Leave blank when this routine is not pet care."
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

function ResponsibilityFields({
  defaults,
  members,
}: {
  defaults: RoutineFormDefaults;
  members: readonly Member[];
}) {
  return (
    <FormSection legend="Responsibility">
      <FormField label="Assignment">
        <select
          className={selectClassName}
          defaultValue={defaults.assignmentPolicy ?? "shared"}
          name="assignmentPolicy"
        >
          <option value="shared">Shared</option>
          <option value="assigned">Assigned</option>
          <option value="alternating">Alternating</option>
        </select>
      </FormField>
      <FormField
        label="Assigned member or rotation starter"
        description="Ignored for a shared routine."
      >
        <select
          className={selectClassName}
          defaultValue={defaults.memberId ?? members[0]?.user_id}
          name="memberId"
        >
          {members.map((member) => (
            <option key={member.user_id} value={member.user_id}>
              {member.display_name}
            </option>
          ))}
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
  action: (formData: FormData) => Promise<void>;
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
      <ResponsibilityFields defaults={defaults} members={members} />
      <RoutineScheduleFields
        defaultDate={defaultDate}
        defaultMode={defaults.scheduleMode ?? "one_off"}
        rule={defaults.scheduleRule ?? {}}
      />
    </FormFields>
  );
}
