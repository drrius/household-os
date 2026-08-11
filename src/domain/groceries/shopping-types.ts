import type {
  ExpenseDraftId,
  GroceryItemId,
  GroceryItemState,
  ShoppingSessionId,
  ShoppingSessionState,
} from "./types";

export type ShoppingExpenseDraftProposal = {
  description: string;
  amountCents: number | null;
  payerMemberId: string | null;
  proposedAllocations: readonly {
    memberId: string;
    allocatedCents: number;
  }[];
  occurredOn: string;
};

export type FinishShoppingInput = {
  sessionId: ShoppingSessionId;
  session: ShoppingSessionState;
  claimedItems: readonly {
    id: GroceryItemId;
    state: GroceryItemState;
  }[];
  finishedAt: string;
  occurredOn: string;
  createExpenseDraft: boolean;
  expenseDraftId: ExpenseDraftId | null;
  description?: string;
  sharedAmountCents?: number | null;
  payerMemberId?: string | null;
  proposedAllocations?: readonly {
    memberId: string;
    allocatedCents: number;
  }[];
  receiptTotalCents?: number | null;
};

export type FinishShoppingPlan = {
  purchasedItemIds: GroceryItemId[];
  session: Extract<ShoppingSessionState, { status: "finished" }>;
  draft: ShoppingExpenseDraftProposal | null;
  receiptTotalCents: number | null;
};

export type FinishShoppingError = {
  code:
    | "session_already_finished"
    | "no_claimed_items"
    | "invalid_item_state"
    | "draft_requires_amount"
    | "unsafe_cent_amount";
  message: string;
};

export type FinishShoppingResult =
  | { ok: true; plan: FinishShoppingPlan; changed: boolean }
  | { ok: false; error: FinishShoppingError };
