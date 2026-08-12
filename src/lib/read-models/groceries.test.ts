import { describe, expect, it, vi } from "vitest";

import { mapGroceriesViewModel, type GroceriesReadInput } from "./groceries";

vi.mock("server-only", () => ({}));

const viewerId = "00000000-0000-0000-0000-000000000001";
const partnerId = "00000000-0000-0000-0000-000000000002";

function groceriesInput(
  overrides: Partial<GroceriesReadInput> = {},
): GroceriesReadInput {
  return {
    viewerId,
    categories: [],
    items: [],
    sessions: [],
    members: [
      { user_id: viewerId, display_name: "Sam" },
      { user_id: partnerId, display_name: "Leah" },
    ],
    history: [],
    ...overrides,
  };
}

describe("mapGroceriesViewModel", () => {
  it("orders categories and items while exposing claims and duplicate hints", () => {
    const model = mapGroceriesViewModel(
      groceriesInput({
        categories: [
          {
            id: "dairy",
            name: "Dairy & Eggs",
            sort_order: 3,
          },
          {
            id: "produce",
            name: "Produce",
            sort_order: 1,
          },
        ],
        items: [
          {
            id: "apple",
            name: "Apples",
            quantity: null,
            unit: null,
            category_id: "produce",
            note: "Pink Lady",
            sort_order: 2,
            state: "active",
            claimed_by_session_id: null,
          },
          {
            id: "milk-two",
            name: " milk ",
            quantity: "2",
            unit: "L",
            category_id: "dairy",
            note: null,
            sort_order: 2,
            state: "active",
            claimed_by_session_id: null,
          },
          {
            id: "tomato",
            name: "Tomatoes",
            quantity: null,
            unit: null,
            category_id: "produce",
            note: null,
            sort_order: 1,
            state: "claimed",
            claimed_by_session_id: "partner-session",
          },
          {
            id: "milk-one",
            name: "Milk",
            quantity: "1",
            unit: "L",
            category_id: "dairy",
            note: "Whole",
            sort_order: 1,
            state: "active",
            claimed_by_session_id: null,
          },
        ],
        sessions: [
          {
            id: "partner-session",
            member_id: partnerId,
            started_at: "2026-08-12T08:00:00Z",
          },
        ],
        history: [{ id: "bread" }, { id: "eggs" }],
      }),
    );

    expect(model.activeItemCount).toBe(4);
    expect(model.categories.map((category) => category.name)).toEqual([
      "Produce",
      "Dairy & Eggs",
    ]);
    expect(model.categories[0]?.items.map((item) => item.name)).toEqual([
      "Tomatoes",
      "Apples",
    ]);
    expect(model.categories[0]?.items[0]?.claimedByName).toBe("Leah");
    expect(model.categories[1]?.items[0]?.duplicateHint).toContain(
      "Quantity or unit differs",
    );
    expect(model.categories[1]?.items.map((item) => item.quantity)).toEqual([
      "1",
      "2",
    ]);
    expect(model.categories[1]?.items.map((item) => item.unit)).toEqual([
      "L",
      "L",
    ]);
    expect(model.duplicates).toEqual([
      {
        leftId: "milk-one",
        rightId: "milk-two",
        leftName: "Milk",
        rightName: " milk ",
      },
    ]);
    expect(model.liveSession).toEqual({
      id: "partner-session",
      memberName: "Leah",
      claimedCount: 1,
      totalCount: 4,
      isMine: false,
    });
    expect(model.recentHistoryLabel).toBe(
      "2 items purchased in the last 30 days",
    );
  });

  it("prefers the viewer's live session when both members are shopping", () => {
    const model = mapGroceriesViewModel(
      groceriesInput({
        categories: [
          {
            id: "produce",
            name: "Produce",
            sort_order: 1,
          },
        ],
        items: [
          {
            id: "mine",
            name: "Apples",
            quantity: null,
            unit: null,
            category_id: "produce",
            note: null,
            sort_order: 1,
            state: "claimed",
            claimed_by_session_id: "viewer-session",
          },
          {
            id: "theirs",
            name: "Tomatoes",
            quantity: null,
            unit: null,
            category_id: "produce",
            note: null,
            sort_order: 2,
            state: "claimed",
            claimed_by_session_id: "partner-session",
          },
        ],
        sessions: [
          {
            id: "partner-session",
            member_id: partnerId,
            started_at: "2026-08-12T08:00:00Z",
          },
          {
            id: "viewer-session",
            member_id: viewerId,
            started_at: "2026-08-12T09:00:00Z",
          },
        ],
      }),
    );

    expect(model.liveSession).toEqual({
      id: "viewer-session",
      memberName: "Sam",
      claimedCount: 1,
      totalCount: 2,
      isMine: true,
    });
  });

  it("places uncategorized items in Other and omits empty history", () => {
    const model = mapGroceriesViewModel(
      groceriesInput({
        items: [
          {
            id: "misc",
            name: "Batteries",
            quantity: null,
            unit: null,
            category_id: null,
            note: null,
            sort_order: 0,
            state: "active",
            claimed_by_session_id: null,
          },
        ],
      }),
    );

    expect(model.categories).toEqual([
      {
        id: "uncategorized",
        name: "Other",
        items: [
          {
            id: "misc",
            name: "Batteries",
            quantity: null,
            unit: null,
            note: null,
            claimedByName: null,
            claimedByMe: false,
            duplicateHint: null,
          },
        ],
      },
    ]);
    expect(model.liveSession).toBeNull();
    expect(model.duplicates).toEqual([]);
    expect(model.recentHistoryLabel).toBeNull();
  });
});
