import "server-only";

import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { validateReceiptPath } from "@/lib/money/receipt";
import { createClient } from "@/lib/supabase/server";

const draftSchema = z.object({
  id: z.string().uuid(),
  description: z.string(),
  amount_cents: z.number().int().nonnegative().nullable(),
  payer_member_id: z.string().uuid().nullable(),
  occurred_on: z.string(),
  proposed_allocations: z.unknown(),
  category_id: z.string().uuid().nullable(),
  shopping_session_id: z.string().uuid().nullable(),
});

export async function loadMoneyDraft(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const member = await requireMemberContext();
  const client = await createClient();
  const result = await client
    .from("expense_drafts")
    .select(
      "id, description, amount_cents, payer_member_id, occurred_on, proposed_allocations, category_id, shopping_session_id",
    )
    .eq("household_id", member.householdId)
    .eq("id", id)
    .eq("status", "pending")
    .maybeSingle();
  if (result.error) throw new Error("Could not load this expense draft.");
  if (!result.data) return null;
  const draft = draftSchema.parse(result.data);
  let receipt_path: string | null = null;
  let receipt_total_cents: number | null = null;
  if (draft.shopping_session_id) {
    const session = await client
      .from("shopping_sessions")
      .select("receipt_path, receipt_total_cents")
      .eq("household_id", member.householdId)
      .eq("id", draft.shopping_session_id)
      .single();
    if (session.error) throw new Error("Could not load the shopping receipt.");
    receipt_path = validateReceiptPath(
      session.data.receipt_path,
      member.householdId,
    );
    receipt_total_cents = session.data.receipt_total_cents;
  }
  return { ...draft, receipt_path, receipt_total_cents };
}
