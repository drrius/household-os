import { compareIsoDates } from "@/domain/routines/dates";
import { mealBoardDate } from "./board";
import type {
  MealBoardPosition,
  MealDefinitionSnapshot,
  MealGroceryTemplateSnapshot,
  MealPlanEntryId,
  MealPlanEntrySnapshot,
} from "./types";
import type {
  MealPlacementError,
  MealPlacementPlan,
  PlannedGroceryFromTemplate,
} from "./placement-types";

export function trimMealTitle(title: string): string | null {
  const trimmed = title.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function templatesToGroceries(
  templates: readonly MealGroceryTemplateSnapshot[],
): PlannedGroceryFromTemplate[] {
  return templates.map((template) => ({
    name: template.name,
    quantity: template.quantity,
    unit: template.unit,
    groceryCategoryId: template.groceryCategoryId,
    note: template.note,
    sortOrder: template.sortOrder,
  }));
}

export function shouldMaterializeDefaultGroceries(input: {
  position: MealBoardPosition;
  leftoverOfEntryId: MealPlanEntryId | null;
  mealDefinitionId: MealDefinitionSnapshot["id"] | null;
  alreadyMaterialized: boolean;
}): boolean {
  if (input.alreadyMaterialized) {
    return false;
  }
  if (input.leftoverOfEntryId !== null) {
    return false;
  }
  if (input.mealDefinitionId === null) {
    return false;
  }
  return input.position.kind === "slot";
}

export function planLibraryPlacement(input: {
  position: MealBoardPosition;
  definition: MealDefinitionSnapshot;
  templates: readonly MealGroceryTemplateSnapshot[];
  title?: string;
  notes?: string | null;
}):
  | { ok: true; plan: MealPlacementPlan }
  | { ok: false; error: MealPlacementError } {
  const title = trimMealTitle(input.title ?? input.definition.name);
  if (title === null) {
    return {
      ok: false,
      error: { code: "empty_title", message: "Meal title is required" },
    };
  }

  const materialize = shouldMaterializeDefaultGroceries({
    position: input.position,
    leftoverOfEntryId: null,
    mealDefinitionId: input.definition.id,
    alreadyMaterialized: false,
  });

  return {
    ok: true,
    plan: {
      position: input.position,
      mealDefinitionId: input.definition.id,
      titleSnapshot: title,
      recipeUrlSnapshot: input.definition.recipeUrl,
      notes: input.notes ?? input.definition.notes,
      leftoverOfEntryId: null,
      materializeGroceries: materialize,
      groceries: materialize ? templatesToGroceries(input.templates) : [],
    },
  };
}

export function planFreeformPlacement(input: {
  position: MealBoardPosition;
  title: string;
  recipeUrl?: string | null;
  notes?: string | null;
}):
  | { ok: true; plan: MealPlacementPlan }
  | { ok: false; error: MealPlacementError } {
  const title = trimMealTitle(input.title);
  if (title === null) {
    return {
      ok: false,
      error: { code: "empty_title", message: "Meal title is required" },
    };
  }

  return {
    ok: true,
    plan: {
      position: input.position,
      mealDefinitionId: null,
      titleSnapshot: title,
      recipeUrlSnapshot: input.recipeUrl ?? null,
      notes: input.notes ?? null,
      leftoverOfEntryId: null,
      materializeGroceries: false,
      groceries: [],
    },
  };
}

export function planLeftoverPlacement(input: {
  position: MealBoardPosition;
  source: MealPlanEntrySnapshot;
  notes?: string | null;
}):
  | { ok: true; plan: MealPlacementPlan }
  | { ok: false; error: MealPlacementError } {
  if (input.source.leftoverOfEntryId !== null) {
    return {
      ok: false,
      error: {
        code: "leftover_of_leftover",
        message: "A leftover cannot reference another leftover",
      },
    };
  }

  const targetDate = mealBoardDate(input.position);
  if (compareIsoDates(input.source.date, targetDate) >= 0) {
    return {
      ok: false,
      error: {
        code: "leftover_not_earlier",
        message: "Leftover source must be an earlier meal-plan entry",
      },
    };
  }

  return {
    ok: true,
    plan: {
      position: input.position,
      mealDefinitionId: input.source.mealDefinitionId,
      titleSnapshot: input.source.titleSnapshot,
      recipeUrlSnapshot: input.source.recipeUrlSnapshot,
      notes: input.notes ?? input.source.notes,
      leftoverOfEntryId: input.source.id,
      materializeGroceries: false,
      groceries: [],
    },
  };
}
