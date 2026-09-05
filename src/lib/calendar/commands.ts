import "server-only";
import { insertCalendarEvent } from "./create-event";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { parseCalendarForm } from "@/domain/calendar/forms";
import { masterFromIcal, readCalendar } from "@/domain/calendar/ical-read";
import { writeCalendar } from "@/domain/calendar/ical-write";
import {
  calendarContext,
  getCalendarEvent,
  getConnectionSummary,
} from "./context";
import { CalendarError } from "./errors";
import { inputFromRow, rowFields, type CalendarRow } from "./rows";

async function saveVersion(
  row: CalendarRow,
  values: Record<string, unknown>,
  version: string,
) {
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_events")
    .update(values)
    .eq("id", row.id)
    .eq("household_id", member.householdId)
    .eq("updated_at", version)
    .select("id")
    .maybeSingle();
  if (error)
    throw new CalendarError(
      "network",
      "Could not save the event. Check the details and try again.",
    );
  if (!data)
    throw new CalendarError(
      "conflict",
      "This event changed while you were editing. Reload it before saving again.",
    );
}
export async function saveCalendarEvent(
  form: FormData,
  creationId?: string,
): Promise<string> {
  if (creationId) z.uuid().parse(creationId);
  await calendarContext();
  const id = String(form.get("id") || "");
  const row = id ? await getCalendarEvent(z.uuid().parse(id)) : null;
  if (row?.sync_state === "conflict")
    throw new CalendarError(
      "conflict",
      "Resolve the iCloud conflict before editing this event.",
    );
  const input = parseCalendarForm(
    Object.fromEntries(form),
    row?.recurrence_rule ?? null,
  );
  const connection = await getConnectionSummary();
  if (row?.connection_id && connection?.read_only)
    throw new CalendarError(
      "permission",
      "This iCloud calendar is read-only. Edit it with its owner in Apple Calendar.",
    );
  const publish = form.get("publish") === "on";
  if (publish && (!connection?.selected_calendar_url || connection.read_only))
    throw new CalendarError(
      "permission",
      "Connect an editable iCloud calendar before publishing.",
    );
  const uid = row?.ical_uid ?? `${creationId ?? randomUUID()}@household-os`;
  const recurrenceId = String(form.get("recurrenceId") || "") || null;
  if (
    recurrenceId &&
    (!row ||
      !readCalendar(
        row.ical_data ??
          writeCalendar(inputFromRow(row), { uid: row.ical_uid }),
      ).event.isRecurring())
  )
    throw new CalendarError("invalid", "This is not a repeating event.");
  const ical = writeCalendar(input, {
    uid,
    existing: row?.ical_data ?? row?.ical_edit_base ?? row?.last_synced_ical,
    recurrenceId,
    resetRecurrence: form.get("repeat") !== "keep",
  });
  const master = recurrenceId
    ? {
        ...inputFromRow(row!),
        ...masterFromIcal(ical),
        attendance: input.attendance,
        attendingMemberId: input.attendingMemberId,
        projectId: input.projectId,
      }
    : input;
  const binding = row?.connection_id ?? (publish ? connection!.id : null);
  const values = {
    ...rowFields(master),
    ical_uid: uid,
    ical_data: ical,
    ical_edit_base: null,
    connection_id: binding,
    sync_state: binding ? "pending" : "local",
    cancelled_at: null,
    last_sync_error: null,
  };
  if (row) await saveVersion(row, values, String(form.get("version") || ""));
  else return insertCalendarEvent(values, creationId);
  return row!.id;
}
export async function cancelCalendarEvent(form: FormData) {
  const row = await getCalendarEvent(z.uuid().parse(form.get("id")));
  const connection = await getConnectionSummary();
  if (row.connection_id && connection?.read_only)
    throw new CalendarError("permission", "This iCloud calendar is read-only.");
  if (row.sync_state === "conflict")
    throw new CalendarError(
      "conflict",
      "Resolve the conflict before cancelling this event.",
    );
  const recurrenceId = String(form.get("recurrenceId") || "") || null;
  const ical = writeCalendar(inputFromRow(row), {
    uid: row.ical_uid,
    existing: row.ical_data ?? row.ical_edit_base ?? row.last_synced_ical,
    recurrenceId,
    cancelled: true,
  });
  await saveVersion(
    row,
    {
      ical_data: ical,
      ical_edit_base: null,
      cancelled_at: recurrenceId ? null : new Date().toISOString(),
      sync_state: row.connection_id ? "pending" : "local",
    },
    String(form.get("version") || ""),
  );
}
export async function resolveCalendarConflict(form: FormData) {
  const choices = form.getAll("choice");
  const choice = z.enum(["local", "remote"]).safeParse(choices[0]);
  if (choices.length !== 1 || !choice.success)
    throw new CalendarError(
      "invalid",
      "Choose which version to keep before resolving this conflict.",
    );
  const row = await getCalendarEvent(z.uuid().parse(form.get("id")));
  if (row.sync_state !== "conflict" || row.remote_conflict_ical === null)
    throw new CalendarError(
      "conflict",
      "This conflict has already changed. Reload the event.",
    );
  const useRemote = choice.data === "remote";
  if (!useRemote && (await getConnectionSummary())?.read_only)
    throw new CalendarError(
      "permission",
      "Keep the Apple version for a read-only calendar, or disconnect to keep an editable local copy.",
    );
  let values: Record<string, unknown> = {
    sync_state: useRemote ? "synced" : "pending",
    remote_etag: row.remote_conflict_etag,
    last_synced_ical: row.remote_conflict_ical || null,
    remote_conflict_ical: null,
    remote_conflict_etag: null,
    last_sync_error: null,
  };
  if (useRemote) {
    const remote = row.remote_conflict_ical
      ? masterFromIcal(row.remote_conflict_ical)
      : null;
    values = {
      ...values,
      ...(remote
        ? rowFields({
            ...remote,
            attendance: row.attendance,
            attendingMemberId: row.attending_member_id,
            projectId: row.project_id,
          })
        : {}),
      ical_data: row.remote_conflict_ical || row.ical_data,
      cancelled_at:
        !remote || remote.cancelled ? new Date().toISOString() : null,
    };
  }
  await saveVersion(row, values, String(form.get("version") || ""));
}
