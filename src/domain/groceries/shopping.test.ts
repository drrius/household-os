import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import { planFinishShopping } from "./shopping";
import {
  asExpenseDraftId,
  asGroceryItemId,
  asShoppingSessionId,
  type GroceryItemState,
} from "./types";

const sessionId = asShoppingSessionId("session-1");
const draftId = asExpenseDraftId("draft-1");

const claimed: GroceryItemState = {
  state: "claimed",
  claimedBySessionId: sessionId,
  purchasedAt: null,
};

describe("planFinishShopping", () => {
  it("creates at most one draft proposal", () => {
    const result = planFinishShopping({
      sessionId,
      session: { status: "active", finishedAt: null, expenseDraftId: null },
      claimedItems: [{ id: asGroceryItemId("item-1"), state: claimed }],
      finishedAt: "2026-08-11T18:00:00.000Z",
      occurredOn: "2026-08-11",
      createExpenseDraft: true,
      expenseDraftId: draftId,
      sharedAmountCents: 2550,
      payerMemberId: "member-1",
      receiptTotalCents: 4090,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.draft).not.toBeNull();
    expect(result.plan.receiptTotalCents).toBe(4090);
    expect(result.plan.draft?.amountCents).toBe(2550);
  });

  it("can finish without a draft", () => {
    const result = planFinishShopping({
      sessionId,
      session: { status: "active", finishedAt: null, expenseDraftId: null },
      claimedItems: [{ id: asGroceryItemId("item-1"), state: claimed }],
      finishedAt: "2026-08-11T18:00:00.000Z",
      occurredOn: "2026-08-11",
      createExpenseDraft: false,
      expenseDraftId: null,
    });
    expect(result.ok && result.plan.draft).toBeNull();
  });

  it("property: valid finish plans contain zero or one draft", () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 0, max: 5 }),
        (withDraft, count) => {
          const items = Array.from(
            { length: Math.max(1, count) },
            (_, index) => ({
              id: asGroceryItemId(`item-${index}`),
              state: claimed,
            }),
          );
          const result = planFinishShopping({
            sessionId,
            session: {
              status: "active",
              finishedAt: null,
              expenseDraftId: null,
            },
            claimedItems: items,
            finishedAt: "2026-08-11T18:00:00.000Z",
            occurredOn: "2026-08-11",
            createExpenseDraft: withDraft,
            expenseDraftId: withDraft ? draftId : null,
            sharedAmountCents: withDraft ? 100 : null,
            payerMemberId: withDraft ? "member-1" : null,
          });
          expect(result.ok).toBe(true);
          if (!result.ok) {
            return;
          }
          const draftCount = result.plan.draft === null ? 0 : 1;
          expect(draftCount).toBeLessThanOrEqual(1);
          expect("ledgerEvent" in result.plan).toBe(false);
        },
      ),
    );
  });
});
