import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { zurichCivilDate } from "../today/useToday";
import { newIdempotencyKey } from "./idempotency";

async function householdUserIds(householdId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("household_members")
    .select("user_id")
    .eq("household_id", householdId)
    .order("user_id");
  if (error) throw new Error(error.message);
  return ((data ?? []) as { user_id: string }[]).map((m) => m.user_id);
}

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

export async function postManualExpense5050(
  session: SessionState,
  description: string,
  amountCents: number
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  if (!description.trim()) throw new Error("Description is required.");
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Amount must be positive centimes.");
  }
  const ids = await householdUserIds(session.householdId);
  if (ids.length !== 2 || !ids.includes(session.userId)) {
    throw new Error("Household must have exactly two members.");
  }
  const other = ids.find((id) => id !== session.userId) ?? "";
  const { error } = await supabase.rpc("post_manual_expense", {
    p_household_id: session.householdId,
    p_description: description.trim(),
    p_amount_cents: amountCents,
    p_payer_member_id: session.userId,
    p_allocations: split5050(amountCents, session.userId, other),
    p_occurred_on: zurichCivilDate(0),
    p_idempotency_key: newIdempotencyKey(),
    p_category_id: null,
    p_note: null,
    p_receipt_path: null,
  });
  if (error) throw new Error(error.message);
}

export async function recordFullSettlement(
  session: SessionState,
  amountCents: number,
  heroKind: "partner_owes_you" | "you_owe_partner"
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new Error("Nothing to settle.");
  }
  const ids = await householdUserIds(session.householdId);
  const other = ids.find((id) => id !== session.userId) ?? session.userId;
  const payer = heroKind === "partner_owes_you" ? other : session.userId;
  const { error } = await supabase.rpc("record_settlement", {
    p_household_id: session.householdId,
    p_payer_member_id: payer,
    p_amount_cents: amountCents,
    p_occurred_on: zurichCivilDate(0),
    p_description: "Settle up",
    p_idempotency_key: newIdempotencyKey(),
    p_note: null,
    p_mode: "full",
  });
  if (error) throw new Error(error.message);
}

export async function dismissExpenseDraft(
  session: SessionState,
  draftId: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("dismiss_expense_draft", {
    p_draft_id: draftId,
    p_idempotency_key: newIdempotencyKey(),
  });
  if (error) throw new Error(error.message);
}
