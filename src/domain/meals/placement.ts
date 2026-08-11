import { validateMealBoardPosition } from "./board";
import {
  planFreeformPlacement,
  planLeftoverPlacement,
  planLibraryPlacement,
  shouldMaterializeDefaultGroceries,
  templatesToGroceries,
} from "./placement-sources";
import type {
  MealPlacementError,
  MealPlacementPlan,
  PlannedGroceryFromTemplate,
} from "./placement-types";
import type {
  IsoDate,
  MealBoardPosition,
  MealDefinitionSnapshot,
  MealGroceryTemplateSnapshot,
  MealPlanEntrySnapshot,
} from "./types";

export type MealPlacement =
  | {
      kind: "library";
      definition: MealDefinitionSnapshot;
      templates: readonly MealGroceryTemplateSnapshot[];
      title?: string;
      notes?: string | null;
    }
  | {
      kind: "freeform";
      title: string;
      recipeUrl?: string | null;
      notes?: string | null;
    }
  | {
      kind: "leftover";
      source: MealPlanEntrySnapshot;
      notes?: string | null;
    };

export type {
  MealPlacementError,
  MealPlacementPlan,
  PlannedGroceryFromTemplate,
};

export type MealPlacementResult =
  | { ok: true; plan: MealPlacementPlan }
  | { ok: false; error: MealPlacementError };

export type MealMovePlan = {
  position: MealBoardPosition;
  materializeGroceries: boolean;
  groceries: PlannedGroceryFromTemplate[];
};

export type MealMoveResult =
  { ok: true; plan: MealMovePlan } | { ok: false; error: MealPlacementError };

export { shouldMaterializeDefaultGroceries };

export function planMealPlacement(input: {
  date: string;
  slot: string | null;
  placement: MealPlacement;
}): MealPlacementResult {
  const positionResult = validateMealBoardPosition({
    date: input.date,
    slot: input.slot,
  });
  if (!positionResult.ok) {
    return {
      ok: false,
      error: {
        code: "invalid_position",
        message: positionResult.error.message,
      },
    };
  }

  const position = positionResult.position;
  switch (input.placement.kind) {
    case "library":
      return planLibraryPlacement({
        position,
        definition: input.placement.definition,
        templates: input.placement.templates,
        title: input.placement.title,
        notes: input.placement.notes,
      });
    case "freeform":
      return planFreeformPlacement({
        position,
        title: input.placement.title,
        recipeUrl: input.placement.recipeUrl,
        notes: input.placement.notes,
      });
    case "leftover":
      return planLeftoverPlacement({
        position,
        source: input.placement.source,
        notes: input.placement.notes,
      });
    default: {
      const _exhaustive: never = input.placement;
      return _exhaustive;
    }
  }
}

export function planMealMove(input: {
  entry: MealPlanEntrySnapshot;
  date: string;
  slot: string | null;
  templates: readonly MealGroceryTemplateSnapshot[];
}): MealMoveResult {
  const positionResult = validateMealBoardPosition({
    date: input.date,
    slot: input.slot,
  });
  if (!positionResult.ok) {
    return {
      ok: false,
      error: {
        code: "invalid_position",
        message: positionResult.error.message,
      },
    };
  }

  const position = positionResult.position;
  const materialize = shouldMaterializeDefaultGroceries({
    position,
    leftoverOfEntryId: input.entry.leftoverOfEntryId,
    mealDefinitionId: input.entry.mealDefinitionId,
    alreadyMaterialized: input.entry.groceriesMaterializedAt !== null,
  });

  return {
    ok: true,
    plan: {
      position,
      materializeGroceries: materialize,
      groceries: materialize ? templatesToGroceries(input.templates) : [],
    },
  };
}

export type { IsoDate };
