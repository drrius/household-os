import "server-only";

import { revalidatePath } from "next/cache";

import {
  resolveAllocations,
  type ExpenseSplit,
} from "@/lib/ai/execute/allocations";
import type { AiWriteHandler } from "@/lib/ai/execute/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import type { MoneyAllocationInput } from "@/lib/money/commands";
import { startOfZurichWeek } from "@/lib/ui/zurich-date";
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

/** Current recipe/notes of an entry, so partial updates can keep them. */
async function readMealEntrySnapshot(
  entryId: string,
): Promise<{ recipeUrl: string | null; notes: string | null }> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meal_plan_entries")
    .select("recipe_url_snapshot, notes")
    .eq("household_id", member.householdId)
    .eq("id", entryId)
    .single();
  if (error !== null) {
    throw new Error(`meal entry lookup failed: ${error.message}`);
  }
  const row = data as {
    recipe_url_snapshot: string | null;
    notes: string | null;
  };
  return { recipeUrl: row.recipe_url_snapshot, notes: row.notes };
}

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
  finish_shopping_session: async (input, { today }) => {
    const value = input as {
      shoppingSessionId: string;
      receiptTotalCents?: number | null;
      createExpenseDraft: boolean;
      expenseDescription?: string | null;
      sharedAmountCents?: number | null;
      payerMemberId?: string | null;
      split?: ExpenseSplit | null;
    };
    // A draft stored without allocations cannot be confirmed later, so
    // resolve them here (equal split unless the model provided one).
    let proposedAllocations: readonly MoneyAllocationInput[] = [];
    if (value.createExpenseDraft) {
      if (value.sharedAmountCents == null || value.payerMemberId == null) {
        throw new Error(
          "createExpenseDraft needs sharedAmountCents and payerMemberId",
        );
      }
      proposedAllocations = await resolveAllocations(
        value.split ?? { kind: "equal" },
        value.sharedAmountCents,
        value.payerMemberId,
      );
    }
    return finishShoppingSession({
      shoppingSessionId: value.shoppingSessionId,
      idempotencyKey: `finish-shopping:${value.shoppingSessionId}`,
      occurredOn: today,
      receiptTotalCents: value.receiptTotalCents ?? null,
      createExpenseDraft: value.createExpenseDraft,
      expenseDescription: value.expenseDescription ?? null,
      sharedAmountCents: value.sharedAmountCents ?? null,
      payerMemberId: value.payerMemberId ?? null,
      proposedAllocations,
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
      // Unslotted notes attach to the week; the database only accepts
      // them anchored to that week's Monday.
      date: value.slot == null ? startOfZurichWeek(value.date) : value.date,
      slot: value.slot ?? null,
      sourceKind: value.source.kind,
      idempotencyKey,
      mealDefinitionId:
        value.source.kind === "library" ? value.source.mealDefinitionId : null,
      leftoverOfEntryId:
        value.source.kind === "leftover"
          ? value.source.leftoverOfEntryId
          : null,
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
  update_meal_entry: async (input, { idempotencyKey }) => {
    const value = input as {
      entryId: string;
      title: string;
      date: string;
      slot: MealSlot;
      recipeUrl?: string | null;
      notes?: string | null;
    };
    // A rename must not erase metadata: omitted (undefined) keeps the
    // stored value, explicit null clears it.
    const current = await readMealEntrySnapshot(value.entryId);
    return updateMealPlanEntry({
      entryId: value.entryId,
      title: value.title,
      date: value.date,
      slot: value.slot,
      recipeUrl:
        value.recipeUrl === undefined ? current.recipeUrl : value.recipeUrl,
      notes: value.notes === undefined ? current.notes : value.notes,
      idempotencyKey,
    });
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
  // These commands touch tables no realtime surface watches, so refresh
  // /home the same way the household server actions do.
  create_area: async (input) => {
    const result = await createArea((input as { name: string }).name);
    revalidatePath("/home");
    return result;
  },
  create_pet: async (input) => {
    const result = await createPet((input as { name: string }).name);
    revalidatePath("/home");
    return result;
  },
  update_household_name: async (input) => {
    await updateHouseholdName((input as { name: string }).name);
    revalidatePath("/home");
    return { done: true };
  },
};
