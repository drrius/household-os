import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { newIdempotencyKey } from "./idempotency";

export async function placeFreeformMeal(
  session: SessionState,
  date: string,
  slot: "breakfast" | "lunch" | "dinner",
  title: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  if (!title.trim()) throw new Error("Title is required.");
  const { error } = await supabase.rpc("place_meal", {
    p_household_id: session.householdId,
    p_date: date,
    p_slot: slot,
    p_source_kind: "freeform",
    p_idempotency_key: newIdempotencyKey(),
    p_meal_definition_id: null,
    p_leftover_of_entry_id: null,
    p_title: title.trim(),
    p_recipe_url: null,
    p_notes: null,
  });
  if (error) throw new Error(error.message);
}

export async function removeMealEntry(
  session: SessionState,
  entryId: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("remove_meal_plan_entry", {
    p_entry_id: entryId,
    p_idempotency_key: newIdempotencyKey(),
  });
  if (error) throw new Error(error.message);
}

export async function markInboxRead(
  session: SessionState,
  notificationIds: string[]
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  if (notificationIds.length === 0) return;
  const { error } = await supabase.rpc("mark_inbox_notifications_read", {
    p_notification_ids: notificationIds,
  });
  if (error) throw new Error(error.message);
}
