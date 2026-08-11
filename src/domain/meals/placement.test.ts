import { describe, expect, it } from "vitest";
import * as fc from "fast-check";
import {
  planMealMove,
  planMealPlacement,
  shouldMaterializeDefaultGroceries,
} from "./placement";
import {
  asIsoDate,
  asMealDefinitionId,
  asMealGroceryTemplateId,
  asMealPlanEntryId,
  type MealDefinitionSnapshot,
  type MealGroceryTemplateSnapshot,
  type MealPlanEntrySnapshot,
} from "./types";

const definition: MealDefinitionSnapshot = {
  id: asMealDefinitionId("def-1"),
  name: "Pasta",
  recipeUrl: "https://example.invalid/pasta",
  notes: "al dente",
};

const templates: MealGroceryTemplateSnapshot[] = [
  {
    id: asMealGroceryTemplateId("tpl-1"),
    name: "Spaghetti",
    quantity: "500",
    unit: "g",
    groceryCategoryId: "cat-1",
    note: null,
    sortOrder: 0,
  },
  {
    id: asMealGroceryTemplateId("tpl-2"),
    name: "Tomato sauce",
    quantity: "1",
    unit: "jar",
    groceryCategoryId: null,
    note: null,
    sortOrder: 1,
  },
];

const sourceEntry: MealPlanEntrySnapshot = {
  id: asMealPlanEntryId("entry-1"),
  date: asIsoDate("2026-08-10"),
  slot: "dinner",
  mealDefinitionId: definition.id,
  titleSnapshot: "Pasta",
  recipeUrlSnapshot: definition.recipeUrl,
  notes: definition.notes,
  leftoverOfEntryId: null,
  groceriesMaterializedAt: "2026-08-10T10:00:00.000Z",
};

describe("planMealPlacement", () => {
  it("materializes library groceries on a scheduled slot", () => {
    const result = planMealPlacement({
      date: "2026-08-11",
      slot: "dinner",
      placement: { kind: "library", definition, templates },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.materializeGroceries).toBe(true);
    expect(result.plan.groceries).toHaveLength(2);
  });

  it("does not materialize groceries for leftovers", () => {
    const result = planMealPlacement({
      date: "2026-08-12",
      slot: "lunch",
      placement: { kind: "leftover", source: sourceEntry },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.leftoverOfEntryId).toBe(sourceEntry.id);
    expect(result.plan.materializeGroceries).toBe(false);
    expect(result.plan.groceries).toEqual([]);
  });

  it("does not materialize groceries for ideas", () => {
    const result = planMealPlacement({
      date: "2026-08-10",
      slot: null,
      placement: { kind: "library", definition, templates },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.plan.position.kind).toBe("idea");
    expect(result.plan.materializeGroceries).toBe(false);
    expect(result.plan.groceries).toEqual([]);
  });

  it("materializes once when promoting an idea to a slot", () => {
    const ideaEntry: MealPlanEntrySnapshot = {
      ...sourceEntry,
      id: asMealPlanEntryId("idea-1"),
      date: asIsoDate("2026-08-10"),
      slot: null,
      groceriesMaterializedAt: null,
    };
    const first = planMealMove({
      entry: ideaEntry,
      date: "2026-08-11",
      slot: "dinner",
      templates,
    });
    expect(first.ok && first.plan.materializeGroceries).toBe(true);
    const second = planMealMove({
      entry: {
        ...ideaEntry,
        groceriesMaterializedAt: "2026-08-11T12:00:00.000Z",
      },
      date: "2026-08-12",
      slot: "lunch",
      templates,
    });
    expect(second.ok && second.plan.materializeGroceries).toBe(false);
  });

  it("property: leftovers never plan default groceries", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 28 }),
        fc.constantFrom("breakfast", "lunch", "dinner"),
        (dayOffset, slot) => {
          const day = String(10 + (dayOffset % 18)).padStart(2, "0");
          const result = planMealPlacement({
            date: `2026-08-${day}`,
            slot,
            placement: { kind: "leftover", source: sourceEntry },
          });
          if (!result.ok) {
            expect(result.error.code).toBe("leftover_not_earlier");
            return;
          }
          expect(result.plan.groceries).toEqual([]);
          expect(result.plan.materializeGroceries).toBe(false);
        },
      ),
    );
  });

  it("property: materialization happens at most once", () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (wasMaterialized, isLeftover) => {
        const materialize = shouldMaterializeDefaultGroceries({
          position: {
            kind: "slot",
            date: asIsoDate("2026-08-11"),
            slot: "dinner",
          },
          leftoverOfEntryId: isLeftover ? asMealPlanEntryId("src") : null,
          mealDefinitionId: definition.id,
          alreadyMaterialized: wasMaterialized,
        });
        if (wasMaterialized || isLeftover) {
          expect(materialize).toBe(false);
        }
      }),
    );
  });
});
