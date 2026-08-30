"use client";

import { useEffect, useRef, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import { echoedList } from "@/lib/forms/echo";
import { DateField } from "@/ui/forms/date-field.client";
import {
  useFormFieldValue,
  useFormFieldsState,
} from "@/ui/forms/form-fields.client";
import { FormField, FormSection } from "@/ui/forms/form-page";
import { EchoedSelect, FormSelect } from "@/ui/forms/form-select.client";

const scheduleModes = [
  { label: "One-off date", value: "one_off" },
  { label: "Daily", value: "daily" },
  { label: "Selected weekdays", value: "weekdays" },
  { label: "Weekly", value: "weekly" },
  { label: "Every two weeks", value: "biweekly" },
  { label: "Monthly by date", value: "monthly" },
  { label: "After completion", value: "after_completion" },
] as const;

export type ScheduleMode = (typeof scheduleModes)[number]["value"];

const weekdays = [
  [1, "Monday"],
  [2, "Tuesday"],
  [3, "Wednesday"],
  [4, "Thursday"],
  [5, "Friday"],
  [6, "Saturday"],
  [7, "Sunday"],
] as const;

const emptyWeekdayMessage = "Choose at least one weekday.";

function toScheduleMode(value: string): ScheduleMode {
  const match = scheduleModes.find((mode) => mode.value === value);
  return match === undefined ? "one_off" : match.value;
}

function toSelectedDays(rule: Record<string, unknown>): readonly number[] {
  const stored = Array.isArray(rule.days) ? rule.days : [];
  return weekdays
    .map(([value]) => value)
    .filter((value) => stored.some((day) => Number(day) === value));
}

function echoedWeekdays(
  echoed: string | undefined,
  rule: Record<string, unknown>,
): readonly number[] {
  if (echoed === undefined) return toSelectedDays(rule);
  const selected = new Set(echoedList(echoed).map(Number));
  return weekdays
    .map(([value]) => value)
    .filter((value) => selected.has(value));
}

function WeekdayCheckboxes({
  days,
  onToggle,
}: {
  days: readonly number[];
  onToggle: (day: number, checked: boolean) => void;
}) {
  const missingDays = days.length === 0;
  const guardRef = useRef<HTMLInputElement>(null);
  const bindGuard = (node: HTMLInputElement | null) => {
    guardRef.current = node;
    node?.setCustomValidity(missingDays ? emptyWeekdayMessage : "");
  };

  useEffect(() => {
    guardRef.current?.setCustomValidity(missingDays ? emptyWeekdayMessage : "");
  }, [missingDays]);

  return (
    <FormField label="Selected weekdays" name="weekdays">
      <div className="grid gap-2">
        <input
          aria-hidden
          className="sr-only"
          disabled={!missingDays}
          name="weekdays"
          onChange={() => undefined}
          ref={bindGuard}
          required
          tabIndex={-1}
          value=""
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {weekdays.map(([value, label]) => (
            <label
              className="flex min-h-11 items-center gap-2 text-sm"
              key={value}
            >
              <Checkbox
                checked={days.includes(value)}
                name="weekdays"
                onCheckedChange={(checked) => onToggle(value, checked === true)}
                value={String(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>
    </FormField>
  );
}

function IntervalFields({ rule }: { rule: Record<string, unknown> }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField
        label="Repeat every"
        description="Counted from the day the routine is completed."
      >
        <EchoedInput
          initialValue={String(rule.every ?? 1)}
          min={1}
          name="intervalEvery"
          type="number"
        />
      </FormField>
      <FormField label="Interval unit">
        <EchoedSelect
          initialValue={String(rule.unit ?? "days")}
          items={[
            { label: "Days", value: "days" },
            { label: "Weeks", value: "weeks" },
          ]}
          name="intervalUnit"
        />
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
  mode: Exclude<ScheduleMode, "weekdays">;
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
      <DateField
        defaultValue={String(rule.date ?? defaultDate)}
        label="Date"
        name="oneOffDate"
        required
      />
    );
  }
  if (mode === "weekly" || mode === "biweekly") {
    return (
      <FormField label="Weekday">
        <EchoedSelect
          initialValue={String(rule.weekday ?? 1)}
          items={weekdays.map(([value, label]) => ({
            label,
            value: String(value),
          }))}
          name="weeklyWeekday"
        />
      </FormField>
    );
  }
  if (mode === "monthly") {
    return (
      <FormField label="Day of month">
        <EchoedInput
          initialValue={String(rule.dayOfMonth ?? 1)}
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
  const { values } = useFormFieldsState();
  const [mode, setMode] = useState<ScheduleMode>(
    toScheduleMode(useFormFieldValue("scheduleMode", defaultMode)),
  );
  const [days, setDays] = useState<readonly number[]>(() =>
    echoedWeekdays(values.weekdays, rule),
  );

  const toggleDay = (day: number, checked: boolean) => {
    setDays((current) =>
      weekdays
        .map(([value]) => value)
        .filter((value) => (value === day ? checked : current.includes(value))),
    );
  };

  return (
    <FormSection legend="Schedule">
      <FormField label="Repeat">
        <FormSelect
          items={[...scheduleModes]}
          name="scheduleMode"
          onValueChange={(value) => setMode(toScheduleMode(value))}
          value={mode}
        />
      </FormField>
      {mode === "weekdays" ? (
        <WeekdayCheckboxes days={days} onToggle={toggleDay} />
      ) : (
        <ModeFields defaultDate={defaultDate} mode={mode} rule={rule} />
      )}
    </FormSection>
  );
}
