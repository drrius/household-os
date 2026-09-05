import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { bookingCreateRetryMatches } from "@/domain/trips/create-retry";
import type { parseBookingForm } from "./forms";
export async function saveBooking(input: ReturnType<typeof parseBookingForm>) {
  const member = await requireMemberContext();
  const db = await createClient();
  if (input.version) {
    const { data, error } = await db
      .from("trip_bookings")
      .update(input.fields)
      .eq("household_id", member.householdId)
      .eq("project_id", input.fields.project_id)
      .eq("id", input.id)
      .eq("updated_at", input.version)
      .is("archived_at", null)
      .select("id")
      .maybeSingle();
    if (error?.code === "55000")
      throw new Error("Restore this trip before changing its bookings.");
    if (error || !data)
      throw new Error(
        "This booking changed or is archived. Reload it before saving your edits.",
      );
    return;
  }
  const { error } = await db.from("trip_bookings").insert({
    ...input.fields,
    id: input.id,
    household_id: member.householdId,
    created_by: member.userId,
  });
  if (!error) return;
  if (error.code === "23505") {
    const prior = await db
      .from("trip_bookings")
      .select("*")
      .eq("household_id", member.householdId)
      .eq("project_id", input.fields.project_id)
      .eq("id", input.id)
      .maybeSingle();
    if (
      !prior.error &&
      prior.data &&
      bookingCreateRetryMatches(prior.data, input.fields)
    )
      return;
    throw new Error(
      "This booking was already created and has changed. Reload the trip to inspect it; your changes were not saved.",
    );
  }
  if (error.code === "55000")
    throw new Error("Restore this trip before adding bookings.");
  throw new Error(
    "Couldn't save this booking. Check the details and try again.",
  );
}
export async function archiveBooking(
  projectId: string,
  id: string,
  version: string,
  archived: boolean,
) {
  const member = await requireMemberContext();
  const { data, error } = await (
    await createClient()
  )
    .from("trip_bookings")
    .update({ archived_at: archived ? new Date().toISOString() : null })
    .eq("household_id", member.householdId)
    .eq("project_id", projectId)
    .eq("id", id)
    .eq("updated_at", version)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "This booking or trip changed. Reload before trying again.",
    );
}
