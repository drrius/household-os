import { FormFieldError } from "@/lib/forms/field-error";

export function mealCommandError(error: {
  code?: string;
  message: string;
}): Error {
  if (
    error.code === "23505" &&
    /meal_plan_entries_active_slot_idx/.test(error.message)
  ) {
    return new FormFieldError(
      "slot",
      "There’s already a meal at that time. Choose another slot, or move the other meal first.",
    );
  }
  if (
    /leftover.*(earlier|before)|leftover source must be earlier/.test(
      error.message,
    )
  ) {
    return new FormFieldError(
      "date",
      "Leftovers need to be on a later day than the original meal.",
    );
  }
  if (/already has preparation work/.test(error.message)) {
    return new Error(
      "This meal already has a prep task. Open the meal to manage it.",
    );
  }
  if (/removed|archived/.test(error.message)) {
    return new Error(
      "This meal is no longer available. Return to the plan and choose another meal.",
    );
  }
  return new Error(
    "We couldn’t save this meal change. Check the details and try again.",
  );
}
