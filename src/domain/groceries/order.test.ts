import { describe, expect, it } from "vitest";
import fc from "fast-check";
import {
  groupGroceries,
  MAX_GROCERY_POSITION,
  nextGroceryPosition,
} from "./order";
const categories = [
  { id: "bakery", name: "Bakery", sort_order: 2, is_fallback: false },
  { id: "produce", name: "Produce", sort_order: 1, is_fallback: false },
  { id: "other", name: "Other", sort_order: 3, is_fallback: true },
];
describe("shared grocery order", () => {
  it("applies category order before local item order with stable ID ties", () => {
    const items = [
      { id: "bread", category_id: "bakery", sort_order: 0 },
      { id: "pears", category_id: "produce", sort_order: 9 },
      { id: "apples", category_id: "produce", sort_order: 9 },
      { id: "uncategorized", category_id: null, sort_order: 1 },
      { id: "archived-category", category_id: "archived", sort_order: 0 },
    ];
    expect(
      groupGroceries(categories, items).flatMap((group) =>
        group.items.map((item) => item.id),
      ),
    ).toEqual([
      "apples",
      "pears",
      "bread",
      "archived-category",
      "uncategorized",
    ]);
    expect(items[0]?.id).toBe("bread");
  });
  it("uses the configured Other position and creates a final fallback only when absent", () => {
    const items = [
      { id: "x", category_id: null, sort_order: 0 },
      { id: "y", category_id: "produce", sort_order: 0 },
    ];
    expect(
      groupGroceries(
        [
          { id: "other", name: "Other", sort_order: 0, is_fallback: true },
          categories[1]!,
        ],
        items,
      ).map((group) => group.id),
    ).toEqual(["other", "produce"]);
    expect(
      groupGroceries([categories[1]!], items).map((group) => group.id),
    ).toEqual(["produce", "uncategorized"]);
  });
  it("keeps uncategorized items attached to a renamed and reordered fallback", () => {
    const items = [{ id: "x", category_id: null, sort_order: 0 }];
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant("Other"),
          fc.constant("OTHER"),
          fc.string({ minLength: 1, maxLength: 80 }),
        ),
        fc.nat({ max: 100 }),
        (name, position) => {
          expect(
            groupGroceries(
              [
                {
                  id: "fallback",
                  name,
                  sort_order: position,
                  is_fallback: true,
                },
                {
                  id: "imposter",
                  name: "Other",
                  sort_order: 0,
                  is_fallback: false,
                },
              ],
              items,
            ),
          ).toEqual([
            {
              id: "fallback",
              name:
                name.toLowerCase() === "other" ? `${name} (unassigned)` : name,
              sortOrder: position,
              items,
            },
          ]);
        },
      ),
    );
  });
  it("does not make a category named Other the fallback without its identity", () => {
    expect(
      groupGroceries(
        [{ id: "custom", name: "Other", sort_order: 0, is_fallback: false }],
        [{ id: "x", category_id: null, sort_order: 0 }],
      )[0]?.id,
    ).toBe("uncategorized");
  });
});

it("keeps appending possible even when an edited item reaches the integer limit", () => {
  expect(nextGroceryPosition(MAX_GROCERY_POSITION)).toBe(MAX_GROCERY_POSITION);
  expect(nextGroceryPosition(undefined)).toBe(0);
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: MAX_GROCERY_POSITION }),
      (previous) => {
        const next = nextGroceryPosition(previous);
        expect(next).toBeGreaterThanOrEqual(previous);
        expect(next).toBeLessThanOrEqual(MAX_GROCERY_POSITION);
        expect(Number.isInteger(next)).toBe(true);
      },
    ),
  );
});

it("list and checkout distinguish archived fallback identity from an active namesake", () => {
  const groups = groupGroceries(
    [
      { id: "fallback", name: "Other", is_fallback: true, sort_order: 0 },
      { id: "custom", name: "Other", is_fallback: false, sort_order: 1 },
    ],
    [
      { id: "unassigned", category_id: null, sort_order: 0 },
      { id: "explicit", category_id: "fallback", sort_order: 1 },
      { id: "named", category_id: "custom", sort_order: 0 },
    ],
  );
  expect(
    groups.map(({ id, name, items }) => ({
      id,
      name,
      items: items.map((item) => item.id),
    })),
  ).toEqual([
    {
      id: "fallback",
      name: "Other (unassigned)",
      items: ["unassigned", "explicit"],
    },
    { id: "custom", name: "Other", items: ["named"] },
  ]);
});
