import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { createClient } from "@/lib/supabase/server";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormPage } from "@/ui/forms/form-page";

const draftSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount_cents: z.number().int().nonnegative().nullable(),
  payer_member_id: z.string().uuid().nullable(),
  occurred_on: z.string(),
  proposed_allocations: z.unknown(),
});

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; error?: string }>;
}) {
  const [query, options, member] = await Promise.all([
    searchParams,
    loadMoneyFormOptions(),
    requireMemberContext(),
  ]);
  let draft: z.infer<typeof draftSchema> | null = null;
  if (query.draft && z.string().uuid().safeParse(query.draft).success) {
    const supabase = await createClient();
    const result = await supabase
      .from("expense_drafts")
      .select(
        "id, description, amount_cents, payer_member_id, occurred_on, proposed_allocations",
      )
      .eq("household_id", member.householdId)
      .eq("id", query.draft)
      .eq("status", "pending")
      .maybeSingle();
    if (result.error)
      throw new Error(`expense draft lookup failed: ${result.error.message}`);
    draft = result.data === null ? null : draftSchema.parse(result.data);
  }
  return (
    <FormPage
      backHref="/money"
      description="Record something one of you already paid for. We'll split it and update who owes who straight away."
      error={query.error}
      title={draft ? "Complete expense draft" : "New expense"}
    >
      <ExpenseForm
        categories={options.categories}
        draft={draft}
        members={options.members}
        occurredOn={zurichCivilDate()}
        viewerId={member.userId}
      />
    </FormPage>
  );
}
