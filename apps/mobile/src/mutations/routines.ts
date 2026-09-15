import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { newIdempotencyKey } from "./idempotency";

export async function completeOccurrence(
  session: SessionState,
  occurrenceId: string,
  completedOn: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("complete_occurrence", {
    p_occurrence_id: occurrenceId,
    p_idempotency_key: newIdempotencyKey(),
    p_completed_on: completedOn,
    p_note: null,
    p_photo_path: null,
  });
  if (error) throw new Error(error.message);
}

export async function skipOccurrence(
  session: SessionState,
  occurrenceId: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("skip_occurrence", {
    p_occurrence_id: occurrenceId,
    p_idempotency_key: newIdempotencyKey(),
  });
  if (error) throw new Error(error.message);
}
