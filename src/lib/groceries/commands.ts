import "server-only";
import { nextGroceryPosition } from "@/domain/groceries/order";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

function asRecord(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new Error("Grocery command returned an unexpected payload");
}

export async function createGroceryItem(input: {
  name: string;
  quantity?: string | null;
  unit?: string | null;
  categoryId?: string | null;
  note?: string | null;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  let orderQuery = supabase
    .from("grocery_items")
    .select("sort_order")
    .eq("household_id", member.householdId)
    .in("state", ["active", "claimed"]);
  orderQuery =
    input.categoryId === null || input.categoryId === undefined
      ? orderQuery.is("category_id", null)
      : orderQuery.eq("category_id", input.categoryId);
  const { data: orderRows, error: orderError } = await orderQuery
    .order("sort_order", { ascending: false })
    .limit(1);
  if (orderError) {
    throw new Error(`grocery_item_order failed: ${orderError.message}`);
  }
  const previousOrder = orderRows?.[0]?.sort_order;
  const sortOrder = nextGroceryPosition(
    typeof previousOrder === "number" ? previousOrder : undefined,
  );
  const { data, error } = await supabase
    .from("grocery_items")
    .insert({
      household_id: member.householdId,
      name: input.name,
      quantity: input.quantity ?? null,
      unit: input.unit ?? null,
      category_id: input.categoryId ?? null,
      note: input.note ?? null,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error) {
    throw new Error(`create_grocery_item failed: ${error.message}`);
  }
  return asRecord(data);
}

export async function startShoppingSession(
  householdId?: string,
): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_shopping_session", {
    p_household_id: householdId ?? member.householdId,
  });

  if (error) {
    throw new Error(`start_shopping_session failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function claimGroceryItem(input: {
  shoppingSessionId: string;
  groceryItemId: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("claim_grocery_item", {
    p_shopping_session_id: input.shoppingSessionId,
    p_grocery_item_id: input.groceryItemId,
  });

  if (error) {
    throw new Error(`claim_grocery_item failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function releaseGroceryItem(input: {
  shoppingSessionId: string;
  groceryItemId: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("release_grocery_item", {
    p_shopping_session_id: input.shoppingSessionId,
    p_grocery_item_id: input.groceryItemId,
  });

  if (error) {
    throw new Error(`release_grocery_item failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function removeGroceryItem(
  groceryItemId: string,
): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("remove_grocery_item", {
    p_grocery_item_id: groceryItemId,
  });

  if (error) {
    throw new Error(`remove_grocery_item failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function mergeGroceryItems(input: {
  keepItemId: string;
  removeItemId: string;
  resolvedName: string;
  resolvedQuantity?: string | null;
  resolvedUnit?: string | null;
  resolvedCategoryId?: string | null;
  resolvedNote?: string | null;
  resolvedSortOrder: number;
  idempotencyKey: string;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("merge_grocery_items", {
    p_keep_item_id: input.keepItemId,
    p_remove_item_id: input.removeItemId,
    p_name: input.resolvedName,
    p_quantity: input.resolvedQuantity ?? null,
    p_unit: input.resolvedUnit ?? null,
    p_category_id: input.resolvedCategoryId ?? null,
    p_note: input.resolvedNote ?? null,
    p_sort_order: input.resolvedSortOrder,
    p_idempotency_key: input.idempotencyKey,
  });

  if (error) {
    throw new Error(`merge_grocery_items failed: ${error.message}`);
  }

  return asRecord(data);
}

export async function finishShoppingSession(input: {
  shoppingSessionId: string;
  idempotencyKey: string;
  occurredOn: string;
  receiptTotalCents?: number | null;
  receiptPath?: string | null;
  createExpenseDraft?: boolean;
  expenseDescription?: string | null;
  sharedAmountCents?: number | null;
  payerMemberId?: string | null;
  proposedAllocations?: unknown;
}): Promise<Record<string, unknown>> {
  await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finish_shopping_session", {
    p_shopping_session_id: input.shoppingSessionId,
    p_idempotency_key: input.idempotencyKey,
    p_occurred_on: input.occurredOn,
    p_receipt_total_cents: input.receiptTotalCents ?? null,
    p_receipt_path: input.receiptPath ?? null,
    p_create_expense_draft: input.createExpenseDraft ?? false,
    p_expense_description: input.expenseDescription ?? null,
    p_shared_amount_cents: input.sharedAmountCents ?? null,
    p_payer_member_id: input.payerMemberId ?? null,
    p_proposed_allocations: input.proposedAllocations ?? [],
  });

  if (error) {
    throw new Error(`finish_shopping_session failed: ${error.message}`);
  }

  return asRecord(data);
}
