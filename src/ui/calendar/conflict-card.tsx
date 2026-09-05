"use client";
import { masterFromIcal } from "@/domain/calendar/ical-read";
import { resolveConflictAction } from "@/lib/calendar/actions";
import type { CalendarRow } from "@/lib/calendar/rows";
import { FormFields, FormField } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
export function CalendarConflictCard({ row }: { row: CalendarRow }) {
  let remote;
  try {
    remote = row.remote_conflict_ical
      ? masterFromIcal(row.remote_conflict_ical)
      : null;
  } catch {
    remote = null;
  }
  return (
    <section className="grid gap-4 rounded-2xl border border-destructive p-5">
      <h2 className="font-semibold">Two versions need a decision</h2>
      <p className="text-sm text-muted-foreground">
        Both apps changed this event. Your choice is checked again against the
        latest saved version.
      </p>
      <div className="grid gap-4 @sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium">Household OS</h3>
          <p>{row.cancelled_at ? "Cancelled" : row.title}</p>
          <p className="text-sm text-muted-foreground">
            {row.starts_at} · {row.location}
          </p>
          <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Apple Calendar</h3>
          <p>
            {remote
              ? remote.cancelled
                ? "Cancelled"
                : remote.title
              : "Deleted in Apple Calendar"}
          </p>
          {remote ? (
            <>
              <p className="text-sm text-muted-foreground">
                {remote.startsAt} · {remote.location}
              </p>
              <p className="whitespace-pre-wrap text-sm">{remote.notes}</p>
            </>
          ) : null}
        </div>
      </div>
      <FormFields
        action={resolveConflictAction}
        submitLabel="Keep selected version"
      >
        <input name="id" type="hidden" value={row.id} />
        <input name="version" type="hidden" value={row.updated_at} />
        <FormField label="Version to keep">
          <EchoedSelect
            name="choice"
            initialValue="remote"
            items={[
              { value: "remote", label: "Keep Apple Calendar version" },
              {
                value: "local",
                label: "Keep Household OS version; send on next sync",
              },
            ]}
          />
        </FormField>
      </FormFields>
    </section>
  );
}
