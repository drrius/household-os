import { supabase } from "../lib/supabase";
import type { SessionState } from "../session/SessionProvider";
import { newIdempotencyKey } from "./idempotency";
import { zurichCivilDate } from "../today/useToday";

function requireHousehold(session: SessionState): string {
  if (session.status === "ready" || session.status === "mock") {
    return session.householdId;
  }
  throw new Error("Not signed in.");
}

export async function addGroceryItem(
  session: SessionState,
  name: string
): Promise<void> {
  const householdId = requireHousehold(session);
  if (session.status === "mock") return;
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Name is required.");
  const { error } = await supabase.from("grocery_items").insert({
    household_id: householdId,
    name: trimmed,
    sort_order: Date.now(),
  });
  if (error) throw new Error(error.message);
}

export async function startShoppingSession(
  session: SessionState
): Promise<void> {
  requireHousehold(session);
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("start_shopping_session", {
    p_household_id: session.householdId,
  });
  if (error) throw new Error(error.message);
}

export async function claimGroceryItem(
  session: SessionState,
  shoppingSessionId: string,
  groceryItemId: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("claim_grocery_item", {
    p_shopping_session_id: shoppingSessionId,
    p_grocery_item_id: groceryItemId,
  });
  if (error) throw new Error(error.message);
}

export async function finishShoppingSession(
  session: SessionState,
  shoppingSessionId: string
): Promise<void> {
  if (session.status === "mock") return;
  if (session.status !== "ready") throw new Error("Not signed in.");
  const { error } = await supabase.rpc("finish_shopping_session", {
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
  if (error) throw new Error(error.message);
}
