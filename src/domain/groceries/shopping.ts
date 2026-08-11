import { transitionGroceryItem } from "./item-state";
import {
  assertSafeNonNegativeCents,
  buildShoppingExpenseDraft,
} from "./shopping-draft";
import type {
  FinishShoppingInput,
  FinishShoppingResult,
  ShoppingExpenseDraftProposal,
} from "./shopping-types";
import type { GroceryItemId } from "./types";

export type {
  FinishShoppingError,
  FinishShoppingInput,
  FinishShoppingPlan,
  FinishShoppingResult,
  ShoppingExpenseDraftProposal,
} from "./shopping-types";

export function planFinishShopping(
  input: FinishShoppingInput,
): FinishShoppingResult {
  if (input.session.status === "finished") {
    return {
      ok: true,
      changed: false,
      plan: {
        purchasedItemIds: input.claimedItems.map((item) => item.id),
        session: input.session,
        draft: null,
        receiptTotalCents: input.receiptTotalCents ?? null,
      },
    };
  }

  if (input.claimedItems.length === 0) {
    return {
      ok: false,
      error: {
        code: "no_claimed_items",
        message: "Finish shopping requires at least one claimed item",
      },
    };
  }

  const receiptError = assertSafeNonNegativeCents(
    input.receiptTotalCents,
    "Receipt total",
  );
  if (receiptError) {
    return { ok: false, error: receiptError };
  }

  const sharedError = assertSafeNonNegativeCents(
    input.sharedAmountCents,
    "Shared expense amount",
  );
  if (sharedError) {
    return { ok: false, error: sharedError };
  }

  const purchasedItemIds: GroceryItemId[] = [];
  for (const item of input.claimedItems) {
    const transition = transitionGroceryItem(item.state, {
      kind: "purchase",
      sessionId: input.sessionId,
      purchasedAt: input.finishedAt,
    });
    if (!transition.ok) {
      return {
        ok: false,
        error: {
          code: "invalid_item_state",
          message: transition.error.message,
        },
      };
    }
    purchasedItemIds.push(item.id);
  }

  const draftResult = buildShoppingExpenseDraft(input);
  if (!draftResult.ok) {
    return { ok: false, error: draftResult.error };
  }

  const draft: ShoppingExpenseDraftProposal | null = draftResult.draft;

  return {
    ok: true,
    changed: true,
    plan: {
      purchasedItemIds,
      session: {
        status: "finished",
        finishedAt: input.finishedAt,
        expenseDraftId: draft ? input.expenseDraftId : null,
      },
      draft,
      receiptTotalCents: input.receiptTotalCents ?? null,
    },
  };
}
