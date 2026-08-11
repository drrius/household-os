import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  normalizeGroceryName,
  planExplicitDuplicateMerge,
  suggestGroceryDuplicates,
} from "./duplicates";
import { asGroceryItemId } from "./types";

describe("suggestGroceryDuplicates", () => {
  it("suggests exact normalized-name matches", () => {
    const suggestions = suggestGroceryDuplicates(
      { name: "  Milk  ", quantity: "1", unit: "L" },
      [
        {
          id: asGroceryItemId("a"),
          name: "milk",
          quantity: "2",
          unit: "L",
        },
      ],
    );
    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]?.quantityOrUnitDiffer).toBe(true);
  });

  it("property: merge output equals the explicit resolution", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 40 }),
        fc.option(fc.string({ maxLength: 10 }), { nil: null }),
        fc.option(fc.string({ maxLength: 10 }), { nil: null }),
        fc.integer({ min: 0, max: 100 }),
        (name, quantity, unit, sortOrder) => {
          const plan = planExplicitDuplicateMerge({
            keepItemId: asGroceryItemId("keep"),
            removeItemId: asGroceryItemId("drop"),
            resolution: {
              name,
              quantity,
              unit,
              categoryId: null,
              note: null,
              sortOrder,
            },
          });
          expect(plan.resolution.name).toBe(name.trim());
          expect(plan.resolution.quantity).toBe(quantity);
          expect(plan.resolution.unit).toBe(unit);
          expect(plan.resolution.sortOrder).toBe(sortOrder);
          expect(normalizeGroceryName(name)).toBe(
            name
              .normalize("NFKC")
              .trim()
              .replace(/\s+/g, " ")
              .toLocaleLowerCase("en-US"),
          );
        },
      ),
    );
  });
});
