"use client";

import { useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { FormField, FormSection, selectClassName } from "@/ui/forms/form-page";

const scheduleModes = [
  ["one_off", "One-off date"],
  ["daily", "Daily"],
  ["weekdays", "Selected weekdays"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly by date"],
  ["after_completion", "After completion"],
] as const;

export type ScheduleMode = (typeof scheduleModes)[number][0];

const weekdays = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;

function toScheduleMode(value: string): ScheduleMode {
  const match = scheduleModes.find(([mode]) => mode === value);
  return match === undefined ? "one_off" : match[0];
}

function WeekdayCheckboxes({ selected }: { selected: readonly unknown[] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="text-sm font-medium">Selected weekdays</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weekdays.map(([value, label]) => (
          <label
            className="flex min-h-11 items-center gap-2 text-sm"
            key={value}
          >
            <Checkbox
              defaultChecked={selected.includes(value)}
              name="weekdays"
              value={String(value)}
            />
            {label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function IntervalFields({ rule }: { rule: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Repeat every"
        description="Counted from the day the routine is completed."
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
  );
}

function ModeFields({
  defaultDate,
  mode,
  rule,
}: {
  defaultDate: string;
  mode: ScheduleMode;
  rule: Record<string, unknown>;
}) {
  if (mode === "daily") {
    return (
      <p className="text-sm text-muted-foreground">
        This routine comes back every day.
      </p>
    );
  }
  if (mode === "one_off") {
    return (
      <FormField label="Date">
        <Input
          defaultValue={String(rule.date ?? defaultDate)}
          name="oneOffDate"
          type="date"
        />
      </FormField>
    );
  }
  if (mode === "weekdays") {
    return (
      <WeekdayCheckboxes selected={Array.isArray(rule.days) ? rule.days : []} />
    );
  }
  if (mode === "weekly") {
    return (
      <FormField label="Weekday">
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
    );
  }
  if (mode === "monthly") {
    return (
      <FormField label="Day of month">
        <Input
          defaultValue={String(rule.dayOfMonth ?? 1)}
          max={31}
          min={1}
          name="monthlyDay"
          type="number"
        />
      </FormField>
    );
  }
  return <IntervalFields rule={rule} />;
}

export function RoutineScheduleFields({
  defaultDate,
  defaultMode,
  rule,
}: {
  defaultDate: string;
  defaultMode: ScheduleMode;
  rule: Record<string, unknown>;
}) {
  const [mode, setMode] = useState<ScheduleMode>(defaultMode);
  return (
    <FormSection legend="Schedule">
      <FormField label="Repeat">
        <select
          className={selectClassName}
          defaultValue={defaultMode}
          name="scheduleMode"
          onChange={(event) => setMode(toScheduleMode(event.target.value))}
        >
          {scheduleModes.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </FormField>
      <ModeFields defaultDate={defaultDate} mode={mode} rule={rule} />
    </FormSection>
  );
}
