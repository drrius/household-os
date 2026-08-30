import "server-only";

import type { AiWriteHandler } from "@/lib/ai/execute/types";
import {
  claimGroceryItem,
  createGroceryItem,
  finishShoppingSession,
  releaseGroceryItem,
  removeGroceryItem,
  startShoppingSession,
} from "@/lib/groceries/commands";
import {
  createAndPlaceMeal,
  createMealPreparation,
  moveMealPlanEntry,
  placeMeal,
  removeMealPlanEntry,
  updateMealPlanEntry,
} from "@/lib/meals/commands";
import {
  createArea,
  createPet,
  updateHouseholdName,
} from "@/lib/household/commands";

type MealSlot = "breakfast" | "lunch" | "dinner";

type MealSource =
  | { kind: "library"; mealDefinitionId: string }
  | {
      kind: "freeform";
      title: string;
      recipeUrl?: string | null;
      notes?: string | null;
    }
  | { kind: "leftover"; leftoverOfEntryId: string };

export const GROCERY_HANDLERS: Record<string, AiWriteHandler> = {
  add_grocery_item: (input) =>
    createGroceryItem(
      input as {
        name: string;
        quantity?: string | null;
        unit?: string | null;
        categoryId?: string | null;
        note?: string | null;
      },
    ),
  remove_grocery_item: (input) =>
    removeGroceryItem((input as { groceryItemId: string }).groceryItemId),
  start_shopping_session: () => startShoppingSession(),
  claim_grocery_item: (input) =>
    claimGroceryItem(
      input as { shoppingSessionId: string; groceryItemId: string },
    ),
  release_grocery_item: (input) =>
    releaseGroceryItem(
      input as { shoppingSessionId: string; groceryItemId: string },
    ),
  finish_shopping_session: (input, { today }) => {
    const value = input as {
      shoppingSessionId: string;
      receiptTotalCents?: number | null;
      createExpenseDraft: boolean;
      expenseDescription?: string | null;
      sharedAmountCents?: number | null;
      payerMemberId?: string | null;
    };
    return finishShoppingSession({
      shoppingSessionId: value.shoppingSessionId,
      idempotencyKey: `finish-shopping:${value.shoppingSessionId}`,
      occurredOn: today,
      receiptTotalCents: value.receiptTotalCents ?? null,
      createExpenseDraft: value.createExpenseDraft,
      expenseDescription: value.expenseDescription ?? null,
      sharedAmountCents: value.sharedAmountCents ?? null,
      payerMemberId: value.payerMemberId ?? null,
    });
  },
};

export const MEAL_HANDLERS: Record<string, AiWriteHandler> = {
  plan_meal: (input, { idempotencyKey }) => {
    const value = input as {
      date: string;
      slot?: MealSlot | null;
      source: MealSource;
    };
    if (value.source.kind === "freeform" && value.slot != null) {
      return createAndPlaceMeal({
        name: value.source.title,
        date: value.date,
        slot: value.slot,
        idempotencyKey,
        recipeUrl: value.source.recipeUrl ?? null,
        notes: value.source.notes ?? null,
      });
    }
    return placeMeal({
      date: value.date,
      slot: value.slot ?? null,
      sourceKind: value.source.kind,
      idempotencyKey,
      mealDefinitionId:
        value.source.kind === "library" ? value.source.mealDefinitionId : null,
      leftoverOfEntryId:
        value.source.kind === "leftover" ? value.source.leftoverOfEntryId : null,
      title: value.source.kind === "freeform" ? value.source.title : null,
      recipeUrl:
        value.source.kind === "freeform"
          ? (value.source.recipeUrl ?? null)
          : null,
      notes:
        value.source.kind === "freeform" ? (value.source.notes ?? null) : null,
    });
  },
  move_meal_entry: (input, { idempotencyKey }) => {
    const value = input as {
      entryId: string;
      date: string;
      slot?: MealSlot | null;
    };
    return moveMealPlanEntry({
      entryId: value.entryId,
      date: value.date,
      slot: value.slot ?? null,
      idempotencyKey,
    });
  },
  update_meal_entry: (input, { idempotencyKey }) => {
    const value = input as {
      entryId: string;
      title: string;
      date: string;
      slot: MealSlot;
      recipeUrl?: string | null;
      notes?: string | null;
    };
    return updateMealPlanEntry({ ...value, idempotencyKey });
  },
  remove_meal_entry: (input) => {
    const value = input as { entryId: string };
    return removeMealPlanEntry({
      entryId: value.entryId,
      idempotencyKey: `ai:remove_meal_entry:${value.entryId}`,
    });
  },
  create_meal_preparation: (input, { idempotencyKey }) => {
    const value = input as {
      mealPlanEntryId: string;
      title: string;
      instructions?: string | null;
      dueOn: string;
      areaId: string;
      assignmentPolicy: "assigned" | "alternating" | "shared";
      assignedMemberId?: string | null;
      rotationAnchorMemberId?: string | null;
    };
    return createMealPreparation({ ...value, idempotencyKey });
  },
};

export const HOUSEHOLD_HANDLERS: Record<string, AiWriteHandler> = {
  create_area: (input) => createArea((input as { name: string }).name),
  create_pet: (input) => createPet((input as { name: string }).name),
  update_household_name: async (input) => {
    await updateHouseholdName((input as { name: string }).name);
    return { done: true };
  },
};
