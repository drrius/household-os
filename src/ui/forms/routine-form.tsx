import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  FormField,
  FormFields,
  FormSection,
  selectClassName,
} from "@/ui/forms/form-page";

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
  scheduleMode?:
    | "one_off"
    | "daily"
    | "weekdays"
    | "weekly"
    | "monthly"
    | "after_completion";
  scheduleRule?: Record<string, unknown>;
};
const weekdays = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;

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

function WeekdayFields({ rule }: { rule: Record<string, unknown> }) {
  const selectedDays = Array.isArray(rule.days) ? rule.days : [];
  return (
    <>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Selected weekdays</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {weekdays.map(([value, label]) => (
            <label
              className="flex min-h-11 items-center gap-2 text-sm"
              key={value}
            >
              <input
                className="size-4 accent-primary"
                defaultChecked={selectedDays.includes(value)}
                name="weekdays"
                type="checkbox"
                value={value}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormField
        label="Weekly weekday"
        description="Used only for weekly recurrence."
      >
        <select
          className={selectClassName}
          defaultValue={String(rule.weekday ?? 1)}
          name="weeklyWeekday"
        >
          {weekdays.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <FormField
        label="Day of month"
        description="Used only for monthly recurrence."
      >
        <Input
          defaultValue={String(rule.dayOfMonth ?? 1)}
          max={31}
          min={1}
          name="monthlyDay"
          type="number"
        />
      </FormField>
    </>
  );
}

function ScheduleFields({
  defaultDate,
  defaults,
}: {
  defaultDate: string;
  defaults: RoutineFormDefaults;
}) {
  const rule = defaults.scheduleRule ?? {};
  return (
    <FormSection legend="Schedule">
      <FormField label="Repeat">
        <select
          className={selectClassName}
          defaultValue={defaults.scheduleMode ?? "one_off"}
          name="scheduleMode"
        >
          <option value="one_off">One-off date</option>
          <option value="daily">Daily</option>
          <option value="weekdays">Selected weekdays</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly by date</option>
          <option value="after_completion">After completion</option>
        </select>
      </FormField>
      <FormField
        label="One-off date"
        description="Used only for a one-off routine."
      >
        <Input
          defaultValue={String(rule.date ?? defaultDate)}
          name="oneOffDate"
          type="date"
        />
      </FormField>
      <WeekdayFields rule={rule} />
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          label="Repeat every"
          description="Used only after completion."
        >
          <Input
            defaultValue={String(rule.every ?? 1)}
            min={1}
            name="intervalEvery"
            type="number"
          />
        </FormField>
        <FormField label="Interval unit">
          <select
            className={selectClassName}
            defaultValue={String(rule.unit ?? "days")}
            name="intervalUnit"
          >
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
          </select>
        </FormField>
      </div>
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
      <ScheduleFields defaultDate={defaultDate} defaults={defaults} />
    </FormFields>
  );
}
