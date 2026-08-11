import { addDays, isoWeekday } from "@/domain/routines/dates";
import type { IsoDate, MealBoardPosition, MealSlot } from "./types";
import { asIsoDate } from "./types";

const mealSlots: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];

export type MealBoardPositionError = {
  code: "invalid_slot" | "idea_not_monday";
  message: string;
};

export type MealBoardPositionResult =
  | { ok: true; position: MealBoardPosition }
  | { ok: false; error: MealBoardPositionError };

export function isMealSlot(value: string): value is MealSlot {
  return (mealSlots as readonly string[]).includes(value);
}

export function mondayOfWeek(date: IsoDate): IsoDate {
  const weekday = isoWeekday(date);
  return addDays(date, 1 - weekday);
}

export function mealBoardDate(position: MealBoardPosition): IsoDate {
  switch (position.kind) {
    case "slot":
      return position.date;
    case "idea":
      return position.weekStart;
    default: {
      const _exhaustive: never = position;
      return _exhaustive;
    }
  }
}

export function validateMealBoardPosition(input: {
  date: string;
  slot: string | null;
}): MealBoardPositionResult {
  const date = asIsoDate(input.date);

  if (input.slot === null) {
    if (isoWeekday(date) !== 1) {
      return {
        ok: false,
        error: {
          code: "idea_not_monday",
          message: "Idea board entries must use the week's Monday date",
        },
      };
    }

    return {
      ok: true,
      position: { kind: "idea", weekStart: date, slot: null },
    };
  }

  if (!isMealSlot(input.slot)) {
    return {
      ok: false,
      error: {
        code: "invalid_slot",
        message: `Unknown meal slot: ${input.slot}`,
      },
    };
  }

  return {
    ok: true,
    position: { kind: "slot", date, slot: input.slot },
  };
}
