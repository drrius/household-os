import { describe, expect, it } from "vitest";

import { errorField } from "@/lib/forms/field-error";
import { mealCommandError } from "./command-error";

describe("meal command feedback", () => {
  it("points a concurrent slot conflict at the meal time field", () => {
    const error = mealCommandError({
      code: "23505",
      message:
        'duplicate key violates unique constraint "meal_plan_entries_active_slot_idx"',
    });
    expect(errorField(error)).toBe("slot");
    expect(error.message).toContain("already a meal");
  });
  it("explains invalid leftover order without database details", () => {
    expect(
      errorField(
        mealCommandError({
          message: "move would place a leftover before its source",
        }),
      ),
    ).toBe("date");
    expect(
      mealCommandError({
        message: "caller is not a member of household private-id",
      }).message,
    ).not.toContain("private-id");
  });
});
