import { calendarTimePresentation } from "@/domain/calendar/presentation";
import type { CalendarEventInput } from "@/domain/calendar/types";
import { masterFromIcal } from "@/domain/calendar/ical-read";
import type { CalendarRow } from "@/lib/calendar/rows";
import { ConflictResolutionForm } from "./conflict-resolution-form.client";
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
          <ConflictTime
            event={{
              startsAt: row.starts_at,
              endsAt: row.ends_at,
              timeZone: row.time_zone,
              allDay: row.all_day,
              location: row.location,
            }}
          />
          <p className="whitespace-pre-wrap text-sm">{row.notes}</p>
        </div>
        <div>
          <h3 className="text-sm font-medium">Apple Calendar</h3>
          <p>
            {remote
              ? remote.cancelled
                ? "Cancelled"
                : remote.title
              : row.remote_conflict_ical
                ? "This Apple Calendar version could not be read. Open Apple Calendar to inspect it."
                : "Deleted in Apple Calendar"}
          </p>
          {remote ? (
            <>
              <ConflictTime event={remote} />
              <p className="whitespace-pre-wrap text-sm">{remote.notes}</p>
            </>
          ) : null}
        </div>
      </div>
      <ConflictResolutionForm id={row.id} version={row.updated_at} />
    </section>
  );
}

function ConflictTime({
  event,
}: {
  event: Pick<
    CalendarEventInput,
    "startsAt" | "endsAt" | "timeZone" | "allDay" | "location"
  >;
}) {
  const time = calendarTimePresentation(event);
  return (
    <p className="text-sm text-muted-foreground">
      {time.formatted} · {time.displayTimeZone}
      {event.location ? ` · ${event.location}` : ""}
    </p>
  );
}
