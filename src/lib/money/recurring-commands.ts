import "server-only";
import type { CreateRecurringExpenseRuleInput } from "@/lib/money/commands";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

export async function updateRecurringExpenseRule(
  input: CreateRecurringExpenseRuleInput & {
    ruleId: string;
    expectedUpdatedAt: string;
  },
) {
  await requireMemberContext();
  const client = await createClient();
  const { data, error } = await client.rpc("update_recurring_expense_rule", {
    p_rule_id: input.ruleId,
    p_expected_updated_at: input.expectedUpdatedAt,
    p_description: input.description,
    p_amount_cents: input.amountCents,
    p_payer_member_id: input.payerMemberId,
    p_allocations: input.allocations,
    p_schedule_kind: input.schedule.kind,
    p_next_occurrence_on: input.nextOccurrenceOn,
    p_idempotency_key: input.idempotencyKey,
    p_iso_weekday:
      input.schedule.kind === "weekly" ? input.schedule.isoWeekday : null,
    p_day_of_month:
      input.schedule.kind === "monthly" ? input.schedule.dayOfMonth : null,
    p_category_id: input.categoryId ?? null,
  });
  if (error?.code === "40001")
    throw new Error("This recurring expense changed. Reopen it before saving.");
  if (error)
    throw new Error(`update_recurring_expense_rule failed: ${error.message}`);
  return data;
}
