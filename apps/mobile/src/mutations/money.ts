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

function readyProgram(session: SessionState) {
  return Effect.gen(function* () {
    if (session.status === "mock") return null;
    if (session.status !== "ready") return yield* new NotSignedInError();
    return session;
  });
}

function run<A>(effect: Effect.Effect<A, MutationError>): Promise<A> {
  return runMutation(effect).catch((error: MutationError) => {
    throw new Error(mutationMessage(error));
  });
}

const memberIds = (householdId: string) =>
  query("household_members", async () => {
    const { data, error } = await supabase
      .from("household_members")
      .select("user_id")
      .eq("household_id", householdId)
      .order("user_id");
    if (error) throw error;
    return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
  });

function split5050(amountCents: number, payerId: string, otherId: string) {
  const half = Math.floor(amountCents / 2);
  const remainder = amountCents - half * 2;
  return [
    { member_id: payerId, allocated_cents: half + remainder },
    { member_id: otherId, allocated_cents: half },
  ];
}

export function parseChfToCentimes(input: string): number | null {
  const normalized = input.replace(/CHF\s?/i, "").replace(",", ".").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [francs, cents = ""] = normalized.split(".");
  return Number(francs) * 100 + Number((cents + "00").slice(0, 2));
}

export function postManualExpense5050(
  session: SessionState,
  description: string,
  amountCents: number
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      if (!description.trim()) {
        return yield* new ValidationError({ message: "Description is required." });
      }
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return yield* new ValidationError({
          message: "Amount must be positive centimes.",
        });
      }
      const ids = yield* memberIds(ready.householdId);
      if (ids.length !== 2 || !ids.includes(ready.userId)) {
        return yield* new ValidationError({
          message: "Household must have exactly two members.",
        });
      }
      const other = ids.find((id) => id !== ready.userId) ?? "";
      yield* rpc("post_manual_expense", {
        p_household_id: ready.householdId,
        p_description: description.trim(),
        p_amount_cents: amountCents,
        p_payer_member_id: ready.userId,
        p_allocations: split5050(amountCents, ready.userId, other),
        p_occurred_on: zurichCivilDate(0),
        p_idempotency_key: newIdempotencyKey(),
        p_category_id: null,
        p_note: null,
        p_receipt_path: null,
      });
    })
  );
}

export function recordFullSettlement(
  session: SessionState,
  amountCents: number,
  heroKind: "partner_owes_you" | "you_owe_partner"
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      if (!Number.isInteger(amountCents) || amountCents <= 0) {
        return yield* new ValidationError({ message: "Nothing to settle." });
      }
      const ids = yield* memberIds(ready.householdId);
      const other = ids.find((id) => id !== ready.userId) ?? ready.userId;
      yield* rpc("record_settlement", {
        p_household_id: ready.householdId,
        p_payer_member_id: heroKind === "partner_owes_you" ? other : ready.userId,
        p_amount_cents: amountCents,
        p_occurred_on: zurichCivilDate(0),
        p_description: "Settle up",
        p_idempotency_key: newIdempotencyKey(),
        p_note: null,
        p_mode: "full",
      });
    })
  );
}

export function dismissExpenseDraft(
  session: SessionState,
  draftId: string
): Promise<void> {
  return run(
    Effect.gen(function* () {
      const ready = yield* readyProgram(session);
      if (ready === null) return;
      yield* rpc("dismiss_expense_draft", {
        p_draft_id: draftId,
        p_idempotency_key: newIdempotencyKey(),
      });
    })
  );
}
