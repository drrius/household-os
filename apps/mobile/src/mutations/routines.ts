import * as Effect from "effect/Effect";
import {
  NotSignedInError,
  mutationMessage,
  type MutationError,
} from "../effect/errors";
import { rpc, runMutation } from "../effect/supabase";
import type { SessionState } from "../session/SessionProvider";
import { newIdempotencyKey } from "./idempotency";

function completeProgram(
  session: SessionState,
  occurrenceId: string,
  completedOn: string,
  idempotencyKey: string,
) {
  return Effect.gen(function* () {
    if (session.status === "mock") return;
    if (session.status !== "ready") return yield* new NotSignedInError();
    yield* rpc("complete_occurrence", {
      p_occurrence_id: occurrenceId,
      p_idempotency_key: idempotencyKey,
      p_completed_on: completedOn,
      p_note: null,
      p_photo_path: null,
    });
  });
}

function skipProgram(
  session: SessionState,
  occurrenceId: string,
  idempotencyKey: string,
) {
  return Effect.gen(function* () {
    if (session.status === "mock") return;
    if (session.status !== "ready") return yield* new NotSignedInError();
    yield* rpc("skip_occurrence", {
      p_occurrence_id: occurrenceId,
      p_idempotency_key: idempotencyKey,
    });
  });
}

function run<A>(effect: Effect.Effect<A, MutationError>): Promise<A> {
  return runMutation(effect).catch((error: MutationError) => {
    throw new Error(mutationMessage(error));
  });
}

export function completeOccurrence(
  session: SessionState,
  occurrenceId: string,
  completedOn: string,
  idempotencyKey = newIdempotencyKey(),
): Promise<void> {
  return run(
    completeProgram(session, occurrenceId, completedOn, idempotencyKey),
  );
}

export function skipOccurrence(
  session: SessionState,
  occurrenceId: string,
  idempotencyKey = newIdempotencyKey(),
): Promise<void> {
  return run(skipProgram(session, occurrenceId, idempotencyKey));
}
