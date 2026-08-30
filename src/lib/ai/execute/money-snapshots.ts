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
export async function readDraftSnapshot(draftId: string): Promise<{
  description: string;
  amountCents: number;
  payerMemberId: string;
}> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expense_drafts")
    .select("description, amount_cents, payer_member_id")
    .eq("household_id", member.householdId)
    .eq("id", draftId)
    .single();
  if (error !== null) {
    throw new Error(`expense draft lookup failed: ${error.message}`);
  }
  const row = data as {
    description: string;
    amount_cents: number;
    payer_member_id: string;
  };
  return {
    description: row.description,
    amountCents: row.amount_cents,
    payerMemberId: row.payer_member_id,
  };
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

/** The source event's stored allocations, which refunds must mirror. */
export async function readEventAllocations(
  eventId: string,
): Promise<ReadonlyMap<string, number>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_allocations")
    .select("member_id, allocated_cents")
    .eq("household_id", member.householdId)
    .eq("financial_event_id", eventId);
  if (error !== null || !Array.isArray(data)) {
    throw new Error(`allocations query failed: ${error?.message ?? "no data"}`);
  }
  const shares = new Map<string, number>();
  for (const row of data as { member_id: string; allocated_cents: number }[]) {
    shares.set(row.member_id, row.allocated_cents);
  }
  return shares;
}

/**
 * Centimes already refunded against a source event, net of reversals of
 * those refunds, so cumulative refunds cannot exceed the original.
 */
export async function readRefundedCents(eventId: string): Promise<number> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_events")
    .select("id, type, amount_cents, related_event_id")
    .eq("household_id", member.householdId)
    .in("type", ["refund", "reversal"]);
  if (error !== null || !Array.isArray(data)) {
    throw new Error(`refund query failed: ${error?.message ?? "no data"}`);
  }
  const rows = data as {
    id: string;
    type: "refund" | "reversal";
    amount_cents: number;
    related_event_id: string | null;
  }[];
  const refunds = rows.filter(
    (row) => row.type === "refund" && row.related_event_id === eventId,
  );
  const refundIds = new Set(refunds.map((row) => row.id));
  const reversed = rows
    .filter(
      (row) =>
        row.type === "reversal" &&
        row.related_event_id !== null &&
        refundIds.has(row.related_event_id),
    )
    .reduce((sum, row) => sum + row.amount_cents, 0);
  const refunded = refunds.reduce((sum, row) => sum + row.amount_cents, 0);
  return refunded - reversed;
}
