import { expect, it } from "vitest";
import fc from "fast-check";
import { MAX_GROCERY_POSITION, nextGroceryPosition } from "./order";

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
