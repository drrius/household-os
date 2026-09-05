import "server-only";
import { calendarContext } from "./context";
import { CalendarError } from "./errors";
export async function insertCalendarEvent(
  values: Record<string, unknown>,
  creationId?: string,
): Promise<string> {
  const { db, member } = await calendarContext();
  const { data, error } = await db
    .from("calendar_events")
    .insert({
      ...values,
      ...(creationId ? { id: creationId } : {}),
      household_id: member.householdId,
      created_by: member.userId,
    })
    .select("id")
    .single();
  if (!error) return data.id as string;
  if (creationId && error.code === "23505") {
    const prior = await db
      .from("calendar_events")
      .select("*")
      .eq("household_id", member.householdId)
      .eq("id", creationId)
      .maybeSingle();
    const ignored = new Set([
      "ical_data",
      "ical_edit_base",
      "sync_state",
      "last_sync_error",
    ]);
    if (
      !prior.error &&
      prior.data &&
      Object.entries(values).every(([key, value]) => {
        if (ignored.has(key)) return true;
        if (
          (key === "starts_at" || key === "ends_at") &&
          typeof value === "string"
        )
          return Date.parse(prior.data[key]) === Date.parse(value);
        return prior.data[key] === value;
      })
    )
      return creationId;
    throw new CalendarError(
      "conflict",
      "This event was already created and has changed. Read it before editing; the retry did not overwrite it.",
    );
  }
  throw new CalendarError("network", "Could not add the event. Try again.");
}
