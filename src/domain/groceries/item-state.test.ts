import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { transitionGroceryItem } from "./item-state";
import {
  asGroceryItemId,
  asShoppingSessionId,
  type GroceryItemState,
} from "./types";

const sessionA = asShoppingSessionId("session-a");
const sessionB = asShoppingSessionId("session-b");

const active: GroceryItemState = {
  state: "active",
  claimedBySessionId: null,
  purchasedAt: null,
};

describe("transitionGroceryItem", () => {
  it("claims an active item", () => {
    const result = transitionGroceryItem(active, {
      kind: "claim",
      sessionId: sessionA,
    });
    expect(result).toEqual({
      ok: true,
      changed: true,
      state: {
        state: "claimed",
        claimedBySessionId: sessionA,
        purchasedAt: null,
      },
    });
  });

  it("rejects a claim from a second session", () => {
    const claimed: GroceryItemState = {
      state: "claimed",
      claimedBySessionId: sessionA,
      purchasedAt: null,
    };
    const result = transitionGroceryItem(claimed, {
      kind: "claim",
      sessionId: sessionB,
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("already_claimed_by_other_session");
  });

  it("treats same-session claim retries as idempotent", () => {
    const claimed: GroceryItemState = {
      state: "claimed",
      claimedBySessionId: sessionA,
      purchasedAt: null,
    };
    const result = transitionGroceryItem(claimed, {
      kind: "claim",
      sessionId: sessionA,
    });
    expect(result).toEqual({ ok: true, changed: false, state: claimed });
  });

  it("property: an item never ends claimed by two sessions", () => {
    const sessions = [sessionA, sessionB] as const;
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...sessions), { minLength: 1, maxLength: 12 }),
        (claims) => {
          let state: GroceryItemState = active;
          let owner: string | null = null;
          for (const sessionId of claims) {
            const result = transitionGroceryItem(state, {
              kind: "claim",
              sessionId,
            });
            if (!result.ok) {
              expect(owner).not.toBeNull();
              expect(owner).not.toBe(sessionId);
              continue;
            }
            state = result.state;
            if (state.state === "claimed") {
              owner = state.claimedBySessionId;
            }
          }
          if (state.state === "claimed") {
            expect(state.claimedBySessionId).toBe(owner);
          }
          expect(asGroceryItemId("item-1").length).toBeGreaterThan(0);
        },
      ),
    );
  });
});
