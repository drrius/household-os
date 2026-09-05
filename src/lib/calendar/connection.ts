import "server-only";
import { discoverAppleCalendars } from "./caldav";
import { calendarContext } from "./context";
import {
  decryptCredentials,
  encryptCredentials,
  validateCredentials,
} from "./credentials";
import { CalendarError } from "./errors";
import { createCaldavTransport } from "./transport";
import type { ConnectionSummary } from "./rows";
export async function getPrivateConnection() {
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_connections")
    .select("*")
    .eq("household_id", member.householdId)
    .maybeSingle();
  if (error || !data)
    throw new CalendarError(
      "authentication",
      "Connect your iCloud calendar first.",
    );
  return data as ConnectionSummary & {
    encrypted_credentials: string;
    household_id: string;
  };
}
export async function connectAppleCalendar(form: FormData) {
  const { db, member } = await calendarContext();
  const credentials = validateCredentials(
    String(form.get("username") || ""),
    String(form.get("password") || ""),
  );
  const encrypted = encryptCredentials(credentials, member.householdId);
  await discoverAppleCalendars(createCaldavTransport(credentials));
  const { error } = await db.from("calendar_connections").insert({
    household_id: member.householdId,
    connected_by: member.userId,
    encrypted_credentials: encrypted,
  });
  if (error)
    throw new CalendarError(
      "conflict",
      "A connection already exists, or it could not be saved. Reload this page before trying again.",
    );
}
export async function listConnectedCalendars() {
  const connection = await getPrivateConnection();
  return discoverAppleCalendars(
    createCaldavTransport(
      decryptCredentials(
        connection.encrypted_credentials,
        connection.household_id,
      ),
    ),
  );
}
export async function selectAppleCalendar(form: FormData) {
  const connection = await getPrivateConnection();
  const calendars = await listConnectedCalendars();
  const selected = calendars.find(
    (calendar) => calendar.url === form.get("calendarUrl"),
  );
  if (!selected)
    throw new CalendarError(
      "permission",
      "Choose one of the calendars available to this Apple Account.",
    );
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_connections")
    .update({
      selected_calendar_url: selected.url,
      calendar_name: selected.name,
      read_only: selected.readOnly,
    })
    .eq("id", connection.id)
    .eq("household_id", member.householdId)
    .is("selected_calendar_url", null)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new CalendarError(
      "conflict",
      "The connection changed. Reload before choosing a calendar.",
    );
}
export async function disconnectAppleCalendar() {
  const connection = await getPrivateConnection();
  const { db } = await calendarContext();
  const { error } = await db.rpc("disconnect_calendar", {
    p_connection_id: connection.id,
  });
  if (error)
    throw new CalendarError(
      "busy",
      "Wait for the current sync to finish, then disconnect again.",
    );
}
