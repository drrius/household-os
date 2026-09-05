import "server-only";
import { z } from "zod";
import type { TripBooking } from "@/domain/projects/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
const columns =
  "id, project_id, kind, title, status, starts_at, ends_at, time_zone, end_time_zone, origin, destination, confirmation, website, estimated_amount_cents, calendar_event_id, notes, archived_at, updated_at";
export async function loadBookings(
  projectId: string,
  page = 0,
  archived = false,
) {
  const member = await requireMemberContext();
  let query = (await createClient())
    .from("trip_bookings")
    .select(columns)
    .eq("household_id", member.householdId)
    .eq("project_id", projectId);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data, error } = await query
    .order("starts_at", { ascending: true, nullsFirst: false })
    .order("id")
    .range(page * 40, page * 40 + 40);
  if (error) throw new Error("Couldn't load your bookings. Try again.");
  return {
    bookings: (data as TripBooking[]).slice(0, 40),
    hasMore: data.length > 40,
  };
}
export async function loadBooking(projectId: string, id: string) {
  if (!z.uuid().safeParse(projectId).success || !z.uuid().safeParse(id).success)
    return null;
  const member = await requireMemberContext();
  const { data, error } = await (
    await createClient()
  )
    .from("trip_bookings")
    .select(columns)
    .eq("household_id", member.householdId)
    .eq("project_id", projectId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Couldn't load this booking. Try again.");
  return data as TripBooking | null;
}
