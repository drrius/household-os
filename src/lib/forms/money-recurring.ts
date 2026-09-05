import { FormFieldError } from "@/lib/forms/field-error";
import { z } from "zod";
import { parseExpenseForm } from "@/lib/forms/money";
import type { CreateRecurringExpenseRuleInput } from "@/lib/money/commands";

export function parseRecurringRuleForm(
  form: FormData,
  memberIds: readonly [string, string],
): CreateRecurringExpenseRuleInput {
  const expense = parseExpenseForm(form, memberIds);
  const kind = z.enum(["weekly", "monthly"]).parse(form.get("scheduleKind"));
  const date = new Date(`${expense.occurredOn}T12:00:00Z`);
  const isoWeekday = (date.getUTCDay() || 7) as 1 | 2 | 3 | 4 | 5 | 6 | 7;
  const dayOfMonth =
    kind === "monthly"
      ? z.coerce.number().int().min(1).max(31).parse(form.get("dayOfMonth"))
      : null;
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  if (
    dayOfMonth !== null &&
    date.getUTCDate() !== Math.min(dayOfMonth, lastDay)
  )
    throw new FormFieldError(
      "occurredOn",
      "The next draft date must match the monthly day, or the last day of a shorter month.",
    );
  return {
    ...expense,
    nextOccurrenceOn: expense.occurredOn,
    schedule:
      kind === "weekly"
        ? { kind, isoWeekday }
        : { kind, dayOfMonth: dayOfMonth! },
  };
}
