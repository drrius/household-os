"use client";
import { RecordField, RecordSelect } from "@/ui/projects/record-field.client";
import { TimeZoneField } from "./time-zone-field.client";
const clockChoices = [
  { value: "reject", label: "Ask if the time is ambiguous" },
  { value: "earlier", label: "First occurrence (before clocks go back)" },
  { value: "later", label: "Second occurrence (after clocks go back)" },
];
export function BookingTimes({
  values,
}: {
  values: Readonly<Record<string, string>>;
}) {
  return (
    <>
      <p className="text-sm text-muted-foreground">
        Use the local times shown on your booking. A flight can start and end in
        different time zones.
      </p>
      <RecordField
        name="starts_at"
        label="Start (local date and time)"
        initial={values.starts_at}
        type="datetime-local"
        step="1"
        optional
      />
      <TimeZoneField
        name="time_zone"
        label="Start time zone"
        initial={values.time_zone ?? "Europe/Zurich"}
      />
      <RecordField
        name="ends_at"
        label="End (local date and time)"
        initial={values.ends_at}
        type="datetime-local"
        step="1"
        optional
      />
      <TimeZoneField
        name="end_time_zone"
        label="End time zone"
        initial={values.end_time_zone ?? "Europe/Zurich"}
      />
      <details className="border-t pt-2">
        <summary className="min-h-11 cursor-pointer content-center text-sm">
          Does this time occur twice when clocks change?
        </summary>
        <div className="grid gap-4 pt-3">
          <RecordSelect
            name="start_clock"
            label="Start clock change"
            initial={values.start_clock ?? "reject"}
            options={clockChoices}
          />
          <RecordSelect
            name="end_clock"
            label="End clock change"
            initial={values.end_clock ?? "reject"}
            options={clockChoices}
          />
        </div>
      </details>
    </>
  );
}
