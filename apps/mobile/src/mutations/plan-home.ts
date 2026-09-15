import * as Effect from "effect/Effect";
import {
  NotSignedInError,
  ValidationError,
  mutationMessage,
  type MutationError,
} from "../effect/errors";
import { rpc, runMutation } from "../effect/supabase";
import type { SessionState } from "../session/SessionProvider";
import { newIdempotencyKey } from "./idempotency";

function run<A>(effect: Effect.Effect<A, MutationError>): Promise<A> {
  return runMutation(effect).catch((error: MutationError) => {
    throw new Error(mutationMessage(error));
  });
}

function readyProgram(session: SessionState) {
  return Effect.gen(function* () {
    if (session.status === "mock") return null;
    if (session.status !== "ready") return yield* new NotSignedInError();
    return session;
  });
}

export function placeFreeformMeal(
  session: SessionState,
  date: string,
  slot: "breakfast" | "lunch" | "dinner",
  title: string
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      if (!title.trim()) {
        return yield* new ValidationError({ message: "Title is required." });
      }
      yield* rpc("place_meal", {
        p_household_id: ready.householdId,
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
    })
  );
}

export function removeMealEntry(
  session: SessionState,
  entryId: string
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      yield* rpc("remove_meal_plan_entry", {
        p_entry_id: entryId,
        p_idempotency_key: newIdempotencyKey(),
      });
    })
  );
}

export function markInboxRead(
  session: SessionState,
  notificationIds: string[]
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      if (notificationIds.length === 0) return;
      yield* rpc("mark_inbox_notifications_read", {
        p_notification_ids: notificationIds,
      });
    })
  );
}
