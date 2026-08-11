import type {
  MealBoardPosition,
  MealDefinitionSnapshot,
  MealPlanEntryId,
} from "./types";

export type PlannedGroceryFromTemplate = {
  name: string;
  quantity: string | null;
  unit: string | null;
  groceryCategoryId: string | null;
  note: string | null;
  sortOrder: number;
};

export type MealPlacementPlan = {
  position: MealBoardPosition;
  mealDefinitionId: MealDefinitionSnapshot["id"] | null;
  titleSnapshot: string;
  recipeUrlSnapshot: string | null;
  notes: string | null;
  leftoverOfEntryId: MealPlanEntryId | null;
  materializeGroceries: boolean;
  groceries: PlannedGroceryFromTemplate[];
};

export type MealPlacementError = {
  code:
    | "invalid_position"
    | "empty_title"
    | "leftover_source_missing"
    | "leftover_not_earlier"
    | "leftover_of_leftover";
  message: string;
};
