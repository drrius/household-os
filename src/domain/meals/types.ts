import { asIsoDate, type IsoDate } from "@/domain/routines/types";

export type MealDefinitionId = string & {
  readonly __brand: "MealDefinitionId";
};
export type MealPlanEntryId = string & { readonly __brand: "MealPlanEntryId" };
export type MealGroceryTemplateId = string & {
  readonly __brand: "MealGroceryTemplateId";
};

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type MealBoardPosition =
  | { kind: "slot"; date: IsoDate; slot: MealSlot }
  | { kind: "idea"; weekStart: IsoDate; slot: null };

export type MealDefinitionSnapshot = {
  id: MealDefinitionId;
  name: string;
  recipeUrl: string | null;
  notes: string | null;
};

export type MealGroceryTemplateSnapshot = {
  id: MealGroceryTemplateId;
  name: string;
  quantity: string | null;
  unit: string | null;
  groceryCategoryId: string | null;
  note: string | null;
  sortOrder: number;
};

export type MealPlanEntrySnapshot = {
  id: MealPlanEntryId;
  date: IsoDate;
  slot: MealSlot | null;
  mealDefinitionId: MealDefinitionId | null;
  titleSnapshot: string;
  recipeUrlSnapshot: string | null;
  notes: string | null;
  leftoverOfEntryId: MealPlanEntryId | null;
  groceriesMaterializedAt: string | null;
};

export function asMealDefinitionId(value: string): MealDefinitionId {
  if (value.length === 0) {
    throw new Error("MealDefinitionId must be a non-empty string");
  }
  return value as MealDefinitionId;
}

export function asMealPlanEntryId(value: string): MealPlanEntryId {
  if (value.length === 0) {
    throw new Error("MealPlanEntryId must be a non-empty string");
  }
  return value as MealPlanEntryId;
}

export function asMealGroceryTemplateId(value: string): MealGroceryTemplateId {
  if (value.length === 0) {
    throw new Error("MealGroceryTemplateId must be a non-empty string");
  }
  return value as MealGroceryTemplateId;
}

export { asIsoDate };
export type { IsoDate };
