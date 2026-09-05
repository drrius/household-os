import "server-only";
import { validateCalendarExport } from "@/domain/calendar/ical-export";
import {
  writeAppleEvent,
  deleteAppleEvent,
  type RemoteCalendarObject,
} from "./caldav";
import type { calendarContext } from "./context";
import type { CaldavTransport } from "./transport";
import type { CalendarRow } from "./rows";
import { CalendarError, calendarErrorMessage } from "./errors";
import { canonicalCalendar } from "./canonical";
type Database = Awaited<ReturnType<typeof calendarContext>>["db"];
function validateForPush(ical: string, uid: string) {
  try {
    validateCalendarExport(ical, uid);
  } catch {
    throw new CalendarError(
      "invalid",
      "This event cannot be safely sent to iCloud. Check its identity, times, invitations and notification actions in Apple Calendar before retrying.",
    );
  }
}
export async function pushCalendarEvent(
  db: Database,
  transport: CaldavTransport,
  connectionId: string,
  calendarUrl: string,
  token: string,
  row: CalendarRow,
  remoteObjects: readonly RemoteCalendarObject[],
) {
  try {
    const remote = remoteObjects.find((item) => item.href === row.remote_href);
    if (
      (remote && remote.etag !== row.remote_etag) ||
      (!remote && row.remote_etag)
    )
      throw new CalendarError(
        "conflict",
        "The Apple event version changed. Sync again before sending changes.",
      );
    // The REPORT response is trusted only as fresh remote data, never a stored RPC snapshot.
    if (remote) validateForPush(remote.ical, row.ical_uid);
    row = await prepareEventForPush(db, row);
    validateForPush(row.ical_data!, row.ical_uid);
    await sendPreparedEvent(
      db,
      transport,
      connectionId,
      calendarUrl,
      token,
      row,
    );
  } catch (error) {
    // Use the post-preparation version, and never overwrite a partner's newer edit.
    try {
      await db
        .from("calendar_events")
        .update({ last_sync_error: calendarErrorMessage(error) })
        .eq("id", row.id)
        .eq("household_id", row.household_id)
        .eq("updated_at", row.updated_at)
        .eq("sync_state", "pending");
    } catch {
      /* The connection-level failure remains visible if recording fails. */
    }
    throw error;
  }
}
async function sendPreparedEvent(
  db: Database,
  transport: CaldavTransport,
  connectionId: string,
  calendarUrl: string,
  token: string,
  row: CalendarRow,
) {
  const href =
    row.remote_href ?? `${calendarUrl.replace(/\/$/, "")}/${row.id}.ics`;
  let etag: string | null = null;
  if (row.cancelled_at) {
    if (row.remote_etag)
      await deleteAppleEvent(transport, {
        calendarUrl,
        href,
        etag: row.remote_etag,
      });
  } else
    etag = await writeAppleEvent(transport, {
      calendarUrl,
      href,
      etag: row.remote_etag,
      ical: row.ical_data!,
    });
  const { error } = await db.rpc("record_calendar_push", {
    p_connection_id: connectionId,
    p_token: token,
    p_event_id: row.id,
    p_sent_ical: row.ical_data!,
    p_cancelled: !!row.cancelled_at,
    p_href: href,
    p_etag: etag,
  });
  if (error)
    throw new CalendarError(
      "conflict",
      "The event was sent to iCloud but local confirmation failed. Sync again to reconcile it safely.",
    );
}
async function prepareEventForPush(
  db: Database,
  row: CalendarRow,
): Promise<CalendarRow> {
  if (row.ical_data) return row;
  const ical = canonicalCalendar(row);
  const result = await db
    .from("calendar_events")
    .update({ ical_data: ical, ical_edit_base: null })
    .eq("id", row.id)
    .eq("household_id", row.household_id)
    .eq("updated_at", row.updated_at)
    .select("*")
    .maybeSingle();
  if (result.error || !result.data)
    throw new CalendarError(
      "conflict",
      "This event changed while preparing its sync. Retry to send the latest version.",
    );
  return result.data as CalendarRow;
}
