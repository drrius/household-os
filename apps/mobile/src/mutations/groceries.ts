import * as Effect from "effect/Effect";
import { supabase } from "../lib/supabase";
import {
  NotSignedInError,
  ValidationError,
  mutationMessage,
  type MutationError,
} from "../effect/errors";
import { query, rpc, runMutation } from "../effect/supabase";
import type { SessionState } from "../session/SessionProvider";
import { zurichCivilDate } from "../today/useToday";
import { newIdempotencyKey } from "./idempotency";

function householdProgram(session: SessionState) {
  return Effect.gen(function* () {
    if (session.status === "mock") return session.householdId;
    if (session.status !== "ready") return yield* new NotSignedInError();
    return session.householdId;
  });
}

function run<A>(effect: Effect.Effect<A, MutationError>): Promise<A> {
  return runMutation(effect).catch((error: MutationError) => {
    throw new Error(mutationMessage(error));
  });
}

export function addGroceryItem(session: SessionState, name: string): Promise<void> {
  return run(
    Effect.gen(function* () {
      const householdId = yield* householdProgram(session);
      if (session.status === "mock") return;
      const trimmed = name.trim();
      if (!trimmed) return yield* new ValidationError({ message: "Name is required." });
      yield* query("add_grocery_item", async () => {
        const { error } = await supabase.from("grocery_items").insert({
          household_id: householdId,
          name: trimmed,
          sort_order: Date.now(),
        });
        if (error) throw error;
      });
    })
  );
}

export function startShoppingSession(session: SessionState): Promise<void> {
  return run(
    Effect.gen(function* () {
      const householdId = yield* householdProgram(session);
      if (session.status === "mock") return;
      yield* rpc("start_shopping_session", { p_household_id: householdId });
    })
  );
}

export function claimGroceryItem(
  session: SessionState,
  shoppingSessionId: string,
  groceryItemId: string
): Promise<void> {
  return run(
    Effect.gen(function* () {
      yield* householdProgram(session);
      if (session.status === "mock") return;
      yield* rpc("claim_grocery_item", {
        p_shopping_session_id: shoppingSessionId,
        p_grocery_item_id: groceryItemId,
      });
    })
  );
}

export function finishShoppingSession(
  session: SessionState,
  shoppingSessionId: string
): Promise<void> {
  return run(
    Effect.gen(function* () {
      yield* householdProgram(session);
      if (session.status === "mock") return;
      yield* rpc("finish_shopping_session", {
        p_shopping_session_id: shoppingSessionId,
        p_idempotency_key: newIdempotencyKey(),
        p_occurred_on: zurichCivilDate(0),
        p_receipt_total_cents: null,
        p_receipt_path: null,
        p_create_expense_draft: false,
        p_expense_description: null,
        p_shared_amount_cents: null,
        p_payer_member_id: null,
        p_proposed_allocations: [],
      });
    })
  );
}

