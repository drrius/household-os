import "server-only";

import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import type { LedgerEntry } from "@/domain/money/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

/**
 * The debtor's current outstanding amount, derived from the ledger exactly
 * like the money overview, so approvals can be checked against reality.
 */
export async function readOutstandingDebtCents(
  payerMemberId: string,
): Promise<number> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ledger_entries")
    .select("financial_event_id, member_id, receivable_delta_cents")
    .eq("household_id", member.householdId);
  if (error !== null || !Array.isArray(data)) {
    throw new Error(`ledger query failed: ${error?.message ?? "no data"}`);
  }
  const entries: LedgerEntry[] = (
    data as {
      financial_event_id: string;
      member_id: string;
      receivable_delta_cents: number;
    }[]
  ).map((row) => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
  const balance =
    deriveMemberBalances(entries).get(asMemberId(payerMemberId)) ?? 0;
  return -balance;
}

/** The stored draft values a confirmation must be checked against. */
export async function readDraftSnapshot(
  draftId: string,
): Promise<{ amountCents: number; payerMemberId: string }> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_drafts")
    .select("amount_cents, payer_member_id")
    .eq("household_id", member.householdId)
    .eq("id", draftId)
    .single();
  if (error !== null) {
    throw new Error(`expense draft lookup failed: ${error.message}`);
  }
  const row = data as { amount_cents: number; payer_member_id: string };
  return { amountCents: row.amount_cents, payerMemberId: row.payer_member_id };
}

/** Stored fields of a financial event that corrections must not lose. */
export async function readEventSnapshot(eventId: string): Promise<{
  payerMemberId: string | null;
  categoryId: string | null;
  note: string | null;
  receiptPath: string | null;
}> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_events")
    .select("payer_member_id, category_id, note, receipt_path")
    .eq("household_id", member.householdId)
    .eq("id", eventId)
    .single();
  if (error !== null) {
    throw new Error(`financial event lookup failed: ${error.message}`);
  }
  const row = data as {
    payer_member_id: string | null;
    category_id: string | null;
    note: string | null;
    receipt_path: string | null;
  };
  return {
    payerMemberId: row.payer_member_id,
    categoryId: row.category_id,
    note: row.note,
    receiptPath: row.receipt_path,
  };
}
