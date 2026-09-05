import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const ruleSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount_cents: z.number().int().nonnegative().refine(Number.isSafeInteger),
  payer_member_id: z.string().uuid(),
  proposed_allocations: z.unknown(),
  category_id: z.string().uuid().nullable(),
  schedule_kind: z.enum(["weekly", "monthly"]),
  iso_weekday: z.number().int().nullable(),
  day_of_month: z.number().int().nullable(),
  active: z.boolean(),
  next_occurrence_on: z.string(),
  updated_at: z.string(),
});
export type MoneyRecurringRule = z.infer<typeof ruleSchema>;

export async function loadRecurringRules() {
  const member = await requireMemberContext();
  const client = await createClient();
  const result = await client
    .from("recurring_expense_rules")
    .select(
      "id, description, amount_cents, payer_member_id, proposed_allocations, category_id, schedule_kind, iso_weekday, day_of_month, active, next_occurrence_on, updated_at",
    )
    .eq("household_id", member.householdId)
    .order("active", { ascending: false })
    .order("next_occurrence_on");
  if (result.error) throw new Error("Could not load recurring expenses.");
  return z.array(ruleSchema).parse(result.data);
}
