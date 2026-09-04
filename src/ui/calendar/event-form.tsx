"use client";
import type { CalendarEventInput } from "@/domain/calendar/types";
import {
  isoToLocalDateTime,
  lastAllDayDate,
} from "@/domain/calendar/date-time";
import type { FormAction } from "@/lib/forms/action-state";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { EchoedSelect } from "@/ui/forms/form-select.client";
import { CheckboxField, FormField, FormFields } from "@/ui/forms/form-page";
import { CalendarDateFields } from "./date-fields.client";
export type EventFormOptions = {
  members: { user_id: string; display_name: string }[];
  projects: { id: string; title: string }[];
  canPublish: boolean;
};
export function EventForm({
  action,
  input,
  options,
  id,
  version,
  recurrenceId,
  recurring,
}: {
  action: FormAction;
  input: CalendarEventInput;
  options: EventFormOptions;
  id?: string;
  version?: string;
  recurrenceId?: string;
  recurring?: boolean;
}) {
  return (
    <FormFields action={action} submitLabel={id ? "Save event" : "Add event"}>
      <input type="hidden" name="id" value={id ?? ""} />
      <input type="hidden" name="version" value={version ?? ""} />
      <input type="hidden" name="recurrenceId" value={recurrenceId ?? ""} />
      <FormField label="Title">
        <EchoedInput
          name="title"
          initialValue={input.title}
          maxLength={200}
          required
          autoFocus
        />
      </FormField>
      <EventTimingFields input={input} />
      <AttendanceRepeatFields
        input={input}
        options={options}
        recurrenceId={recurrenceId}
        recurring={recurring}
      />
      <FormField label="Location" optional>
        <EchoedInput
          name="location"
          maxLength={500}
          initialValue={input.location}
        />
      </FormField>
      <FormField label="Notes" optional>
        <EchoedTextarea
          name="notes"
          maxLength={8000}
          initialValue={input.notes}
        />
      </FormField>
      <FormField label="Trip or project" optional>
        <EchoedSelect
          name="projectId"
          initialValue={input.projectId ?? ""}
          items={[
            { value: "", label: "No project" },
            ...options.projects.map((project) => ({
              value: project.id,
              label: project.title,
            })),
          ]}
        />
      </FormField>
      {options.canPublish ? (
        <CheckboxField
          name="publish"
          label="Also add to our connected iCloud calendar"
        />
      ) : null}
    </FormFields>
  );
}

function AttendanceRepeatFields({
  input,
  options,
  recurrenceId,
  recurring,
}: {
  input: CalendarEventInput;
  options: EventFormOptions;
  recurrenceId?: string;
  recurring?: boolean;
}) {
  return (
    <>
      <FormField label="Who is going?">
        <EchoedSelect
          name="attendance"
          initialValue={input.attendance}
          items={[
            { value: "both", label: "Both of us" },
            { value: "one", label: "One of us" },
            { value: "fyi", label: "Just for awareness" },
          ]}
        />
      </FormField>
      <FormField
        label="Person"
        description="Only used when one of us is going."
        optional
      >
        <EchoedSelect
          name="attendingMemberId"
          initialValue={input.attendingMemberId ?? ""}
          items={[
            { value: "", label: "Choose a person" },
            ...options.members.map((member) => ({
              value: member.user_id,
              label: member.display_name,
            })),
          ]}
        />
      </FormField>
      <RepeatPatternField
        input={input}
        recurrenceId={recurrenceId}
        recurring={recurring}
      />
      <FormField
        label="Repeat until"
        optional
        description="Leave empty to keep repeating. Applies when choosing a new repeat pattern."
      >
        <EchoedInput type="date" name="until" />
      </FormField>
    </>
  );
}

function EventTimingFields({ input }: { input: CalendarEventInput }) {
  return (
    <>
      <CalendarDateFields
        start={
          input.allDay
            ? input.startsAt.slice(0, 10)
            : isoToLocalDateTime(input.startsAt, input.timeZone)
        }
        end={
          input.allDay
            ? lastAllDayDate(input.endsAt)
            : isoToLocalDateTime(input.endsAt, input.timeZone)
        }
        allDay={input.allDay}
      />
      <FormField
        label="Time zone"
        description="Dates and times above belong to this zone. The agenda shows Zurich time."
      >
        <EchoedInput
          name="timeZone"
          initialValue={input.timeZone}
          required
          maxLength={100}
          list="calendar-time-zones"
        />
      </FormField>
      <datalist id="calendar-time-zones">
        {[
          "Europe/Zurich",
          "Europe/London",
          "Europe/Paris",
          "America/New_York",
          "America/Los_Angeles",
          "Asia/Tokyo",
          "UTC",
        ].map((zone) => (
          <option key={zone} value={zone} />
        ))}
      </datalist>
    </>
  );
}

function RepeatPatternField({
  input,
  recurrenceId,
  recurring,
}: {
  input: CalendarEventInput;
  recurrenceId?: string;
  recurring?: boolean;
}) {
  return (
    <>
      <FormField label="Repeats">
        <EchoedSelect
          name="repeat"
          initialValue={input.recurrenceRule || recurring ? "keep" : "none"}
          items={
            recurrenceId
              ? [{ value: "keep", label: "Keep this series" }]
              : [
                  { value: "none", label: "Does not repeat" },
                  ...(input.recurrenceRule || recurring
                    ? [
                        {
                          value: "keep",
                          label: `Keep current repeat (${input.recurrenceRule ?? "individual repeat dates"})`,
                        },
                      ]
                    : []),
                  ...(["daily", "weekly", "monthly", "yearly"] as const).map(
                    (value) => ({
                      value,
                      label: value.charAt(0).toUpperCase() + value.slice(1),
                    }),
                  ),
                ]
          }
        />
      </FormField>
    </>
  );
}
