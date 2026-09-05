import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { updateArea, updatePet, reorderAreas } from "@/lib/household/commands";
import {
  loadMealPreparation,
  updateMealPreparation,
} from "@/lib/meals/preparation";
import { parseMealPreparationEdit } from "@/lib/forms/meal-preparation";
import { dailyDetailSchemas as schemas } from "../definitions/daily-detail-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
export const DAILY_DETAIL_HANDLERS: Record<string, AiWriteHandler> = {
  update_meal_preparation: async (input, { idempotencyKey }) => {
    const value = schemas.update_meal_preparation.parse(input);
    const { householdId } = await requireMemberContext();
    const prep = await loadMealPreparation(value.entryId);
    if (!prep || prep.routine.schedule_rule.date !== value.originalDueOn)
      throw new Error(
        "This preparation schedule changed. Read the meal again before editing.",
      );
    await updateMealPreparation(
      parseMealPreparationEdit(
        commandForm({
          ...value,
          idempotencyKey: invocationRecordId(
            `${householdId}:${idempotencyKey}`,
          ),
        }),
      ),
    );
    return { entryId: value.entryId };
  },
  update_household_item: async (input) => {
    const { kind, ...value } = schemas.update_household_item.parse(input);
    if (kind === "area") await updateArea(value);
    else await updatePet(value);
    return { id: value.id };
  },
  reorder_household_areas: async (input) => {
    await reorderAreas(schemas.reorder_household_areas.parse(input).ids);
    return { done: true };
  },
};
