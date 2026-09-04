import "server-only";
import { masterFromIcal } from "@/domain/calendar/ical-read";
import { readAppleCalendar } from "./caldav";
import { pushCalendarEvent } from "./push";
import { getPrivateConnection } from "./connection";
import { calendarContext } from "./context";
import { decryptCredentials } from "./credentials";
import { CalendarError, calendarErrorMessage } from "./errors";
import { createCaldavTransport, type CaldavTransport } from "./transport";
import type { CalendarRow } from "./rows";

type Database = Awaited<ReturnType<typeof calendarContext>>["db"];
async function runSync(
  db: Database,
  connection: Awaited<ReturnType<typeof getPrivateConnection>>,
  token: string,
) {
  const transport = createCaldavTransport(
    decryptCredentials(
      connection.encrypted_credentials,
      connection.household_id,
    ),
    fetch,
    Date.now() + 45000,
  );
  const remoteObjects = await reconcileRemote(db, transport, connection, token);
  if (connection.read_only) {
    await verifySyncFinished(db, connection.id);
    return;
  }
  const pending = await db
    .from("calendar_events")
    .select("*")
    .eq("household_id", connection.household_id)
    .eq("connection_id", connection.id)
    .eq("sync_state", "pending")
    .order("updated_at")
    .limit(21);
  if (pending.error)
    throw new CalendarError(
      "network",
      "Could not load pending calendar changes.",
    );
  for (const row of (pending.data ?? []).slice(0, 20) as CalendarRow[]) {
    try {
      await pushCalendarEvent(
        db,
        transport,
        connection.id,
        connection.selected_calendar_url!,
        token,
        row,
        remoteObjects,
      );
    } catch (error) {
      await db
        .from("calendar_events")
        .update({ last_sync_error: calendarErrorMessage(error) })
        .eq("id", row.id)
        .eq("household_id", connection.household_id)
        .eq("updated_at", row.updated_at);
      throw error;
    }
  }
  if ((pending.data?.length ?? 0) > 20)
    throw new CalendarError(
      "network",
      "More changes are waiting. Sync again to send the next batch.",
    );
  await verifySyncFinished(db, connection.id);
}
export async function syncAppleCalendar(): Promise<void> {
  const connection = await getPrivateConnection();
  if (!connection.selected_calendar_url)
    throw new CalendarError("invalid", "Choose a calendar before syncing.");
  const { db } = await calendarContext();
  const lease = await db.rpc("claim_calendar_sync", {
    p_connection_id: connection.id,
  });
  if (lease.error || !lease.data)
    throw new CalendarError(
      "busy",
      "A sync is already running. Wait a moment and refresh.",
    );
  let failure: unknown;
  try {
    await runSync(db, await getPrivateConnection(), String(lease.data));
  } catch (error) {
    failure = error;
  }
  const released = await db.rpc("release_calendar_sync", {
    p_connection_id: connection.id,
    p_token: lease.data,
    p_error: failure ? calendarErrorMessage(failure) : null,
  });
  if (failure) throw failure;
  if (released.error)
    throw new CalendarError(
      "network",
      "Sync finished but its status could not be saved. Refresh and retry.",
    );
}

async function verifySyncFinished(db: Database, connectionId: string) {
  const unresolved = await db
    .from("calendar_events")
    .select("id", { count: "exact", head: true })
    .eq("connection_id", connectionId)
    .in("sync_state", ["conflict", "pending"]);
  if (unresolved.error || unresolved.count)
    throw new CalendarError(
      "conflict",
      "Some events need attention. Resolve their conflicts or sync again to finish pending changes.",
    );
}

async function reconcileRemote(
  db: Database,
  transport: CaldavTransport,
  connection: Awaited<ReturnType<typeof getPrivateConnection>>,
  token: string,
) {
  const objects = await readAppleCalendar(
    transport,
    connection.selected_calendar_url!,
  );
  let snapshot;
  try {
    snapshot = objects.map((object) => ({
      ...object,
      ...masterFromIcal(object.ical),
    }));
  } catch {
    throw new CalendarError(
      "invalid",
      "An iCloud event has unsupported or invalid calendar data. Nothing was imported or removed. Check the calendar in Apple Calendar, then retry.",
    );
  }
  const { error } = await db.rpc("reconcile_calendar_snapshot", {
    p_connection_id: connection.id,
    p_token: token,
    p_events: snapshot,
  });
  if (error)
    throw new CalendarError(
      "conflict",
      "The calendar changed during import. Retry sync; your local edits are safe.",
    );
  return objects;
}
