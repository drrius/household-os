"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DateField } from "@/ui/forms/date-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";
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

const weekdayErrorId = "weekdays-error";
const emptyWeekdayMessage = "Choose at least one weekday.";

function toScheduleMode(value: string): ScheduleMode {
  const match = scheduleModes.find(([mode]) => mode === value);
  return match === undefined ? "one_off" : match[0];
}

/** Stored rules arrive as JSON, so the days are normalised and ordered here. */
function toSelectedDays(rule: Record<string, unknown>): readonly number[] {
  const stored = Array.isArray(rule.days) ? rule.days : [];
  return weekdays
    .map(([value]) => value)
    .filter((value) => stored.some((day) => Number(day) === value));
}

/**
 * The Repeat control decides which schedule fields exist, so it has to be
 * controlled. `FormField` injects the echoed value of a rejected submit as
 * `defaultValue`, and React refuses a `<select>` carrying both; the echo is
 * seeded into state instead, so the injected default is dropped here.
 */
function ScheduleModeSelect({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  id,
  mode,
  name,
  onModeChange,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  id?: string;
  mode: ScheduleMode;
  name: string;
  onModeChange: (mode: ScheduleMode) => void;
}) {
  return (
    <select
      aria-describedby={describedBy}
      aria-invalid={invalid}
      className={selectClassName}
      id={id}
      name={name}
      onChange={(event) => onModeChange(toScheduleMode(event.target.value))}
      value={mode}
    >
      {scheduleModes.map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}

function WeekdayCheckboxes({
  days,
  error,
  firstDayRef,
  onToggle,
}: {
  days: readonly number[];
  error: string | undefined;
  firstDayRef: RefObject<HTMLSpanElement | null>;
  onToggle: (day: number, checked: boolean) => void;
}) {
  return (
    <fieldset
      aria-describedby={error === undefined ? undefined : weekdayErrorId}
      aria-invalid={error === undefined ? undefined : true}
      className="grid gap-2"
    >
      <legend className="text-sm font-medium">Selected weekdays</legend>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {weekdays.map(([value, label], index) => (
          <label
            className="flex min-h-11 items-center gap-2 text-sm"
            key={value}
          >
            <Checkbox
              checked={days.includes(value)}
              name="weekdays"
              onCheckedChange={(checked) => onToggle(value, checked)}
              ref={index === 0 ? firstDayRef : undefined}
              value={String(value)}
            />
            {label}
          </label>
        ))}
      </div>
      {error === undefined ? null : (
        <p
          className="text-sm text-destructive-strong"
          id={weekdayErrorId}
          role="alert"
        >
          {error}
        </p>
      )}
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

/**
 * The submit button belongs to the shared `FormFields` wrapper, so the only
 * place this sub-form can stop an empty weekday submission is the form element
 * it is mounted into. A capture listener there runs before React's own submit
 * handling, and React skips the action when the native event was prevented.
 */
function useEmptyWeekdayGuard(
  firstDayRef: RefObject<HTMLSpanElement | null>,
  blocked: boolean,
) {
  useEffect(() => {
    const form = blocked ? firstDayRef.current?.closest("form") : null;
    if (form === null || form === undefined) return;
    const block = (event: Event) => {
      event.preventDefault();
      firstDayRef.current?.focus();
    };
    form.addEventListener("submit", block, true);
    return () => {
      form.removeEventListener("submit", block, true);
    };
  }, [blocked, firstDayRef]);
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
  const { errors, values } = useFormFieldsState();
  const [mode, setMode] = useState<ScheduleMode>(() =>
    toScheduleMode(values.scheduleMode ?? defaultMode),
  );
  const [days, setDays] = useState<readonly number[]>(() =>
    toSelectedDays(rule),
  );
  const firstDayRef = useRef<HTMLSpanElement>(null);
  const missingDays = mode === "weekdays" && days.length === 0;
  useEmptyWeekdayGuard(firstDayRef, missingDays);

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
        <ScheduleModeSelect
          mode={mode}
          name="scheduleMode"
          onModeChange={setMode}
        />
      </FormField>
      {mode === "weekdays" ? (
        <WeekdayCheckboxes
          days={days}
          error={missingDays ? emptyWeekdayMessage : errors.weekdays}
          firstDayRef={firstDayRef}
          onToggle={toggleDay}
        />
      ) : (
        <ModeFields defaultDate={defaultDate} mode={mode} rule={rule} />
      )}
    </FormSection>
  );
}
