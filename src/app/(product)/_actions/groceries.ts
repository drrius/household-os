"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { isShoppingReceipt } from "@/domain/groceries/receipt-path";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  claimGroceryItem,
  finishShoppingSession,
  mergeGroceryItems,
  releaseGroceryItem,
  startShoppingSession,
} from "@/lib/groceries/commands";
import { createClient } from "@/lib/supabase/server";
import { parseShoppingForm } from "@/lib/forms/shopping";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";

const groceryItemIdSchema = z.string().uuid();
const claimIntentSchema = z.enum(["claim", "release"]);
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

async function applyGroceryClaimIntent(input: {
  intent: z.infer<typeof claimIntentSchema>;
  itemId: string;
  item: z.infer<typeof claimItemRowSchema>;
  activeSession: z.infer<typeof activeSessionRowSchema> | null;
}): Promise<void> {
  const claimedByViewer =
    input.item.state === "claimed" &&
    input.item.claimed_by_session_id !== null &&
    input.item.claimed_by_session_id === input.activeSession?.id;
  const claimedByOther =
    input.item.state === "claimed" &&
    input.item.claimed_by_session_id !== input.activeSession?.id;

  switch (input.intent) {
    case "release": {
      if (!claimedByViewer) {
        return;
      }
      if (input.activeSession === null) {
        throw new Error(
          "Shopping session is required to release a grocery item",
        );
      }
      await releaseGroceryItem({
        shoppingSessionId: input.activeSession.id,
        groceryItemId: input.itemId,
      });
      return;
    }
    case "claim": {
      if (claimedByViewer) {
        return;
      }
      if (claimedByOther) {
        throw new Error("Grocery item is already in another member's cart");
      }
      const shoppingSessionId =
        input.activeSession?.id ??
        sessionResultSchema.parse(await startShoppingSession())
          .shopping_session_id;
      await claimGroceryItem({
        shoppingSessionId,
        groceryItemId: input.itemId,
      });
      return;
    }
    default: {
      const exhaustiveIntent: never = input.intent;
      throw new Error(`Unhandled grocery claim intent: ${exhaustiveIntent}`);
    }
  }
}

export async function joinShoppingSessionAction(): Promise<void> {
  await startShoppingSession();
  revalidateGroceryViews();
}

export async function finishShoppingCheckoutAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  let sessionId = "";
  const rejected = await settleFormAction(previous, formData, async () => {
    const { members } = await loadMoneyFormOptions();
    if (members.length !== 2)
      throw new Error(
        "Shopping checkout needs both household members. Finish household setup, then try again.",
      );
    const memberIds = z
      .tuple([z.string().uuid(), z.string().uuid()])
      .parse(members.map((member) => member.user_id));
    const input = parseShoppingForm(formData, memberIds);
    sessionId = input.shoppingSessionId;
    const member = await requireMemberContext();
    const receiptPath =
      z
        .string()
        .max(200)
        .parse(formData.get("receiptPath") ?? "") || null;
    if (
      receiptPath !== null &&
      !isShoppingReceipt(receiptPath, member.householdId)
    ) {
      throw new Error("Choose a receipt uploaded to this household.");
    }
    await finishShoppingSession({ ...input, receiptPath });
  });
  if (rejected) return rejected;
  revalidateGroceryViews();
  revalidatePath("/money");
  redirect(`/groceries/shopping/${sessionId}`);
}

export async function claimGroceryItemAction(
  formData: FormData,
): Promise<void> {
  const itemId = groceryItemIdSchema.parse(formData.get("itemId"));
  const intent = claimIntentSchema.parse(formData.get("intent"));
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

  await applyGroceryClaimIntent({ intent, itemId, item, activeSession });
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
    .in("id", [request.leftId, request.rightId]);

  if (error) {
    throw new Error(`Duplicate grocery lookup failed: ${error.message}`);
  }
  const rows = z.array(mergeItemRowSchema).parse(data);
  const keepItem = rows.find((item) => item.id === request.leftId);
  const removeItem = rows.find((item) => item.id === request.rightId);
  if (keepItem === undefined || removeItem === undefined) {
    throw new Error("Both duplicate groceries must belong to the household");
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

export async function cancelShoppingSessionAction(
  formData: FormData,
): Promise<"cancelled" | "completed"> {
  const sessionId = groceryItemIdSchema.parse(formData.get("sessionId"));
  await requireMemberContext();
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_shopping_session", {
    p_shopping_session_id: sessionId,
  });
  if (error) {
    if (error.code === "55000") return "completed";
    throw new Error(`cancel_shopping_session failed: ${error.message}`);
  }
  revalidateGroceryViews();
  return "cancelled";
}
