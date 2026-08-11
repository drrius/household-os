export type GroceryCategoryId = string & {
  readonly __brand: "GroceryCategoryId";
};
export type GroceryItemId = string & { readonly __brand: "GroceryItemId" };
export type ShoppingSessionId = string & {
  readonly __brand: "ShoppingSessionId";
};
export type ExpenseDraftId = string & { readonly __brand: "ExpenseDraftId" };

export type GroceryItemState =
  | { state: "active"; claimedBySessionId: null; purchasedAt: null }
  | {
      state: "claimed";
      claimedBySessionId: ShoppingSessionId;
      purchasedAt: null;
    }
  | { state: "purchased"; claimedBySessionId: null; purchasedAt: string }
  | { state: "removed"; claimedBySessionId: null; purchasedAt: null };

export type ShoppingSessionState =
  | { status: "active"; finishedAt: null; expenseDraftId: null }
  | {
      status: "finished";
      finishedAt: string;
      expenseDraftId: ExpenseDraftId | null;
    };

export function asGroceryCategoryId(value: string): GroceryCategoryId {
  if (value.length === 0) {
    throw new Error("GroceryCategoryId must be a non-empty string");
  }
  return value as GroceryCategoryId;
}

export function asGroceryItemId(value: string): GroceryItemId {
  if (value.length === 0) {
    throw new Error("GroceryItemId must be a non-empty string");
  }
  return value as GroceryItemId;
}

export function asShoppingSessionId(value: string): ShoppingSessionId {
  if (value.length === 0) {
    throw new Error("ShoppingSessionId must be a non-empty string");
  }
  return value as ShoppingSessionId;
}

export function asExpenseDraftId(value: string): ExpenseDraftId {
  if (value.length === 0) {
    throw new Error("ExpenseDraftId must be a non-empty string");
  }
  return value as ExpenseDraftId;
}
