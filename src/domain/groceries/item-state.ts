import type { GroceryItemState, ShoppingSessionId } from "./types";

export type GroceryItemCommand =
  | { kind: "claim"; sessionId: ShoppingSessionId }
  | { kind: "release"; sessionId: ShoppingSessionId }
  | { kind: "purchase"; sessionId: ShoppingSessionId; purchasedAt: string }
  | { kind: "remove" };

export type GroceryItemTransitionError = {
  code:
    | "already_claimed_by_other_session"
    | "not_claimed_by_session"
    | "not_active"
    | "not_claimed"
    | "already_terminal";
  message: string;
};

export type GroceryItemTransitionResult =
  | { ok: true; state: GroceryItemState; changed: boolean }
  | { ok: false; error: GroceryItemTransitionError };

function claimTransition(
  state: GroceryItemState,
  sessionId: ShoppingSessionId,
): GroceryItemTransitionResult {
  switch (state.state) {
    case "active":
      return {
        ok: true,
        changed: true,
        state: {
          state: "claimed",
          claimedBySessionId: sessionId,
          purchasedAt: null,
        },
      };
    case "claimed":
      if (state.claimedBySessionId === sessionId) {
        return { ok: true, changed: false, state };
      }
      return {
        ok: false,
        error: {
          code: "already_claimed_by_other_session",
          message: "Grocery item is claimed by another active session",
        },
      };
    case "purchased":
    case "removed":
      return {
        ok: false,
        error: {
          code: "already_terminal",
          message: `Cannot claim a ${state.state} grocery item`,
        },
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function releaseTransition(
  state: GroceryItemState,
  sessionId: ShoppingSessionId,
): GroceryItemTransitionResult {
  switch (state.state) {
    case "claimed":
      if (state.claimedBySessionId !== sessionId) {
        return {
          ok: false,
          error: {
            code: "not_claimed_by_session",
            message: "Grocery item is not claimed by this session",
          },
        };
      }
      return {
        ok: true,
        changed: true,
        state: {
          state: "active",
          claimedBySessionId: null,
          purchasedAt: null,
        },
      };
    case "active":
      return { ok: true, changed: false, state };
    case "purchased":
    case "removed":
      return {
        ok: false,
        error: {
          code: "already_terminal",
          message: `Cannot release a ${state.state} grocery item`,
        },
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function purchaseTransition(
  state: GroceryItemState,
  sessionId: ShoppingSessionId,
  purchasedAt: string,
): GroceryItemTransitionResult {
  switch (state.state) {
    case "claimed":
      if (state.claimedBySessionId !== sessionId) {
        return {
          ok: false,
          error: {
            code: "not_claimed_by_session",
            message: "Grocery item is not claimed by this session",
          },
        };
      }
      return {
        ok: true,
        changed: true,
        state: {
          state: "purchased",
          claimedBySessionId: null,
          purchasedAt,
        },
      };
    case "purchased":
      return { ok: true, changed: false, state };
    case "active":
      return {
        ok: false,
        error: {
          code: "not_claimed",
          message: "Only claimed grocery items can be purchased",
        },
      };
    case "removed":
      return {
        ok: false,
        error: {
          code: "already_terminal",
          message: "Cannot purchase a removed grocery item",
        },
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

function removeTransition(
  state: GroceryItemState,
): GroceryItemTransitionResult {
  switch (state.state) {
    case "active":
      return {
        ok: true,
        changed: true,
        state: {
          state: "removed",
          claimedBySessionId: null,
          purchasedAt: null,
        },
      };
    case "removed":
      return { ok: true, changed: false, state };
    case "claimed":
      return {
        ok: false,
        error: {
          code: "not_active",
          message: "Claimed grocery items must be released before removal",
        },
      };
    case "purchased":
      return {
        ok: false,
        error: {
          code: "already_terminal",
          message: "Purchased grocery items cannot be removed",
        },
      };
    default: {
      const _exhaustive: never = state;
      return _exhaustive;
    }
  }
}

export function transitionGroceryItem(
  state: GroceryItemState,
  command: GroceryItemCommand,
): GroceryItemTransitionResult {
  switch (command.kind) {
    case "claim":
      return claimTransition(state, command.sessionId);
    case "release":
      return releaseTransition(state, command.sessionId);
    case "purchase":
      return purchaseTransition(state, command.sessionId, command.purchasedAt);
    case "remove":
      return removeTransition(state);
    default: {
      const _exhaustive: never = command;
      return _exhaustive;
    }
  }
}
