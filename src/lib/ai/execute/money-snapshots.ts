import "server-only";

import { deriveMemberBalances } from "@/domain/money/balances";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import type { LedgerEntry } from "@/domain/money/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type LedgerRow = {
  financial_event_id: string;
  member_id: string;
  receivable_delta_cents: number;
};

/** PostgREST truncates responses at supabase/config.toml's max_rows. */
const LEDGER_PAGE_SIZE = 1000;

/**
 * Every ledger row, paged past the API row cap: balances derived from a
 * silently truncated ledger would be wrong, and possibly split mid-event.
 * The ledger is append-only, so ordering by insertion time keeps already
 * fetched pages stable: rows posted mid-pagination sort after the cursor
 * instead of shifting earlier offsets.
 */
export async function fetchAllLedgerRows(
  supabase: ServerClient,
  householdId: string,
): Promise<readonly LedgerRow[]> {
  const rows: LedgerRow[] = [];
  for (let from = 0; ; from += LEDGER_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("ledger_entries")
      .select("financial_event_id, member_id, receivable_delta_cents")
      .eq("household_id", householdId)
      .order("created_at")
      .order("id")
      .range(from, from + LEDGER_PAGE_SIZE - 1);
    if (error !== null || !Array.isArray(data)) {
      throw new Error(`ledger query failed: ${error?.message ?? "no data"}`);
    }
    rows.push(...(data as LedgerRow[]));
    if (data.length < LEDGER_PAGE_SIZE) {
      return rows;
    }
  }
}

/** The append-only ledger rows as branded domain entries. */
export function toLedgerEntries(rows: readonly LedgerRow[]): LedgerEntry[] {
  return rows.map((row) => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
}

/**
 * The debtor's current outstanding amount, derived from the ledger exactly
 * like the money overview, so approvals can be checked against reality.
 */
export async function readOutstandingDebtCents(
  payerMemberId: string,
): Promise<number> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const rows = await fetchAllLedgerRows(supabase, member.householdId);
  const balance =
    deriveMemberBalances(toLedgerEntries(rows)).get(
      asMemberId(payerMemberId),
    ) ?? 0;
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
  description: string;
  amountCents: number;
  payerMemberId: string | null;
  categoryId: string | null;
  note: string | null;
  receiptPath: string | null;
}> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_events")
    .select(
      "description, amount_cents, payer_member_id, category_id, note, receipt_path",
    )
    .eq("household_id", member.householdId)
    .eq("id", eventId)
    .single();
  if (error !== null) {
    throw new Error(`financial event lookup failed: ${error.message}`);
  }
  const row = data as {
    description: string;
    amount_cents: number;
    payer_member_id: string | null;
    category_id: string | null;
    note: string | null;
    receipt_path: string | null;
  };
  return {
    description: row.description,
    amountCents: row.amount_cents,
    payerMemberId: row.payer_member_id,
    categoryId: row.category_id,
    note: row.note,
    receiptPath: row.receipt_path,
  };
}
