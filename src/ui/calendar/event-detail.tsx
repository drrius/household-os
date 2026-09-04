import Link from "next/link";
import { cancelEventAction } from "@/lib/calendar/actions";
import { type CalendarRow, type ConnectionSummary } from "@/lib/calendar/rows";
import { buttonVariants } from "@/components/ui/button";
import { CalendarConflictCard } from "@/ui/calendar/conflict-card";
import { FormFields, FormPage } from "@/ui/forms/form-page";

import type { CalendarEventInput } from "@/domain/calendar/types";
export function EventDetail({
  input,
  row,
  connection,
  issue,
  editable,
  formatted,
  recurring,
  occurrence,
  memberName,
}: {
  input: CalendarEventInput;
  row: CalendarRow;
  connection: ConnectionSummary | null;
  issue: string;
  editable: boolean;
  formatted: string;
  recurring: boolean;
  occurrence?: string;
  memberName: string | null;
}) {
  const id = row.id;
  return (
    <FormPage
      title={input.title}
      backHref="/plan/calendar"
      description={
        row.cancelled_at
          ? "Cancelled event"
          : `${formatted} · ${input.timeZone}`
      }
    >
      <div className="@container grid gap-5">
        {issue ? (
          <p role="alert" className="text-sm text-destructive">
            {issue} Open this event in Apple Calendar.
          </p>
        ) : null}
        <EventFacts
          input={input}
          row={row}
          connection={connection}
          memberName={memberName}
        />
        {row.sync_state === "conflict" ? (
          <CalendarConflictCard row={row} />
        ) : null}
        {row.last_sync_error ? (
          <p role="status" className="text-sm text-destructive">
            {row.last_sync_error}
          </p>
        ) : null}
        <EventEditLinks
          editable={editable}
          row={row}
          occurrence={occurrence}
          recurring={recurring}
          id={id}
        />{" "}
        <CancelEventForm
          editable={editable}
          row={row}
          occurrence={occurrence}
          id={id}
        />
      </div>
    </FormPage>
  );
}

function EventFacts({
  input,
  row,
  connection,
  memberName,
}: {
  input: CalendarEventInput;
  row: CalendarRow;
  connection: ConnectionSummary | null;
  memberName: string | null;
}) {
  return (
    <>
      <dl className="grid gap-4 text-sm">
        <div>
          <dt className="text-muted-foreground">Who</dt>
          <dd>
            {input.attendance === "both"
              ? "Both of us"
              : input.attendance === "one"
                ? (memberName ?? "One of us")
                : "For awareness"}
          </dd>
        </div>
        {input.location ? (
          <div>
            <dt className="text-muted-foreground">Where</dt>
            <dd>{input.location}</dd>
          </div>
        ) : null}
        {input.notes ? (
          <div>
            <dt className="text-muted-foreground">Notes</dt>
            <dd className="whitespace-pre-wrap break-words">{input.notes}</dd>
          </div>
        ) : null}
        {input.projectId ? (
          <div>
            <dt className="text-muted-foreground">Connected project</dt>
            <dd>
              <Link
                href={`/plan/projects/${input.projectId}`}
                className="underline"
              >
                Open project
              </Link>
            </dd>
          </div>
        ) : null}
        <div>
          <dt className="text-muted-foreground">Calendar</dt>
          <dd>
            {row.connection_id
              ? `${connection?.calendar_name ?? "iCloud"} · ${row.sync_state}`
              : "Household OS"}
          </dd>
        </div>
      </dl>
    </>
  );
}

function CancelEventForm({
  editable,
  row,
  occurrence,
  id,
}: {
  editable: boolean;
  row: CalendarRow;
  occurrence?: string;
  id: string;
}) {
  return (
    <>
      {editable && !row.cancelled_at ? (
        <details className="rounded-xl border p-4">
          <summary className="min-h-11 cursor-pointer text-sm font-medium">
            Cancel {occurrence ? "this occurrence or series" : "event"}
          </summary>
          <FormFields
            action={cancelEventAction}
            submitLabel="Confirm cancellation"
          >
            <input name="id" type="hidden" value={id} />
            <input name="version" type="hidden" value={row.updated_at} />
            {occurrence ? (
              <label className="grid gap-2 text-sm">
                What to cancel
                <select
                  name="recurrenceId"
                  className="min-h-11 rounded-md border bg-background p-2"
                >
                  <option value={occurrence}>Only this occurrence</option>
                  <option value="">The whole series</option>
                </select>
              </label>
            ) : null}
            <p className="text-sm text-muted-foreground">
              {row.connection_id
                ? "The cancellation will be sent to iCloud when you sync."
                : "This event will leave the shared agenda."}
            </p>
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input type="checkbox" required className="size-5" /> Cancel this
              plan
            </label>
          </FormFields>
        </details>
      ) : null}
    </>
  );
}

function EventEditLinks({
  editable,
  row,
  occurrence,
  recurring,
  id,
}: {
  editable: boolean;
  row: CalendarRow;
  occurrence?: string;
  recurring: boolean;
  id: string;
}) {
  return (
    <>
      {" "}
      {editable ? (
        <div className="flex flex-wrap gap-3">
          {occurrence && recurring ? (
            <Link
              href={`/plan/calendar/${id}/edit?occurrence=${encodeURIComponent(occurrence)}`}
              className={buttonVariants()}
            >
              Edit this occurrence
            </Link>
          ) : null}
          <Link
            href={`/plan/calendar/${id}/edit`}
            className={buttonVariants({
              variant: occurrence ? "outline" : "default",
            })}
          >
            {recurring
              ? "Edit whole series"
              : row.cancelled_at
                ? "Restore and edit"
                : "Edit event"}
          </Link>
        </div>
      ) : null}
    </>
  );
}
