import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { CalendarError } from "./errors";
import {
  CONNECTION_SUMMARY,
  type CalendarRow,
  type ConnectionSummary,
} from "./rows";
export async function calendarContext() {
  const member = await requireMemberContext();
  const db = await createClient();
  return { member, db };
}
export async function getCalendarEvent(id: string): Promise<CalendarRow> {
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_events")
    .select("*")
    .eq("household_id", member.householdId)
    .eq("id", id)
    .maybeSingle();
  if (error || !data)
    throw new CalendarError("invalid", "This event is no longer available.");
  return data as CalendarRow;
}
export async function getConnectionSummary(): Promise<ConnectionSummary | null> {
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_connections")
    .select(CONNECTION_SUMMARY)
    .eq("household_id", member.householdId)
    .maybeSingle();
  if (error)
    throw new CalendarError("network", "Could not load the iCloud connection.");
  return data as ConnectionSummary | null;
}
export async function getCalendarOptions() {
  const { db, member } = await calendarContext();
  const [members, projects, connection] = await Promise.all([
    db
      .from("household_members")
      .select("user_id,display_name")
      .eq("household_id", member.householdId),
    db
      .from("household_projects")
      .select("id,title")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("title"),
    getConnectionSummary(),
  ]);
  if (members.error || projects.error)
    throw new CalendarError("network", "Could not load calendar options.");
  return {
    members: members.data as { user_id: string; display_name: string }[],
    projects: projects.data as { id: string; title: string }[],
    connection,
  };
}
