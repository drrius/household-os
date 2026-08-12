"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import {
  claimGroceryItem,
  mergeGroceryItems,
  releaseGroceryItem,
  startShoppingSession,
} from "@/lib/groceries/commands";
import { createClient } from "@/lib/supabase/server";

const groceryItemIdSchema = z.string().uuid();
const sessionResultSchema = z.object({
  shopping_session_id: z.string().uuid(),
});
const claimItemRowSchema = z.object({
  state: z.enum(["active", "claimed", "purchased", "removed"]),
  claimed_by_session_id: z.string().uuid().nullable(),
});
const activeSessionRowSchema = z.object({
  id: z.string().uuid(),
});
const mergeItemRowSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  quantity: z.string().nullable(),
  unit: z.string().nullable(),
  category_id: z.string().uuid().nullable(),
  note: z.string().nullable(),
  sort_order: z.number().int().nonnegative(),
});
const mergeRequestSchema = z.object({
  leftId: groceryItemIdSchema,
  rightId: groceryItemIdSchema,
});

function revalidateGroceryViews(): void {
  revalidatePath("/groceries");
  revalidatePath("/");
}

export async function joinShoppingSessionAction(): Promise<void> {
  await startShoppingSession();
  revalidateGroceryViews();
}

export async function claimGroceryItemAction(
  formData: FormData,
): Promise<void> {
  const itemId = groceryItemIdSchema.parse(formData.get("itemId"));
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [itemResult, sessionResult] = await Promise.all([
    supabase
      .from("grocery_items")
      .select("state, claimed_by_session_id")
      .eq("household_id", member.householdId)
      .eq("id", itemId)
      .maybeSingle(),
    supabase
      .from("shopping_sessions")
      .select("id")
      .eq("household_id", member.householdId)
      .eq("member_id", member.userId)
      .is("finished_at", null)
      .maybeSingle(),
  ]);

  if (itemResult.error) {
    throw new Error(`Grocery item lookup failed: ${itemResult.error.message}`);
  }
  if (sessionResult.error) {
    throw new Error(
      `Shopping session lookup failed: ${sessionResult.error.message}`,
    );
  }
  if (itemResult.data === null) {
    throw new Error("Grocery item does not belong to the household");
  }

  const item = claimItemRowSchema.parse(itemResult.data);
  const activeSession =
    sessionResult.data === null
      ? null
      : activeSessionRowSchema.parse(sessionResult.data);
  if (item.state === "purchased" || item.state === "removed") {
    throw new Error(
      "Only active or claimed grocery items can change cart state",
    );
  }
  if (
    item.state === "claimed" &&
    item.claimed_by_session_id !== null &&
    item.claimed_by_session_id === activeSession?.id
  ) {
    await releaseGroceryItem({
      shoppingSessionId: activeSession.id,
      groceryItemId: itemId,
    });
    revalidateGroceryViews();
    return;
  }
  if (
    item.state === "claimed" &&
    item.claimed_by_session_id !== activeSession?.id
  ) {
    throw new Error("Grocery item is already in another member's cart");
  }

  const shoppingSessionId =
    activeSession?.id ??
    sessionResultSchema.parse(await startShoppingSession()).shopping_session_id;
  await claimGroceryItem({
    shoppingSessionId,
    groceryItemId: itemId,
  });
  revalidateGroceryViews();
}

export async function mergeDuplicateGroceryItemsAction(
  formData: FormData,
): Promise<void> {
  const request = mergeRequestSchema.parse({
    leftId: formData.get("leftId"),
    rightId: formData.get("rightId"),
  });
  if (request.leftId === request.rightId) {
    throw new Error("A duplicate merge requires two different grocery items");
  }

  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grocery_items")
    .select("id, name, quantity, unit, category_id, note, sort_order")
    .eq("household_id", member.householdId)
    .eq("state", "active")
    .in("id", [request.leftId, request.rightId]);

  if (error) {
    throw new Error(`Duplicate grocery lookup failed: ${error.message}`);
  }
  const rows = z.array(mergeItemRowSchema).parse(data);
  const keepItem = rows.find((item) => item.id === request.leftId);
  const removeItem = rows.find((item) => item.id === request.rightId);
  if (keepItem === undefined || removeItem === undefined) {
    throw new Error("Both duplicate groceries must still be active");
  }

  await mergeGroceryItems({
    keepItemId: keepItem.id,
    removeItemId: removeItem.id,
    resolvedName: keepItem.name,
    resolvedQuantity: keepItem.quantity,
    resolvedUnit: keepItem.unit,
    resolvedCategoryId: keepItem.category_id,
    resolvedNote: keepItem.note,
    resolvedSortOrder: keepItem.sort_order,
    idempotencyKey: `merge-groceries:${keepItem.id}:${removeItem.id}`,
  });
  revalidateGroceryViews();
}
