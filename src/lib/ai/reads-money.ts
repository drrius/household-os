import "server-only";
import {
  financialHistoryBefore,
  financialHistoryCursor,
  type FinancialHistoryCursor,
} from "@/domain/money/history-cursor";

import { deriveMemberBalances } from "@/domain/money/balances";
import { asMemberId } from "@/domain/money/values";
import {
  fetchAllLedgerRows,
  toLedgerEntries,
} from "@/lib/ai/execute/money-snapshots";
import { memberDirectory, requireRows } from "@/lib/ai/reads";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Page size of the financial-event read; older pages via eventsBefore. */
const RECENT_EVENT_LIMIT = 20;

/**
 * Refunds and corrections must mirror the original shares, so each event
 * carries its allocations instead of forcing the model to guess them.
 */
async function attachAllocations(
  supabase: ServerClient,
  householdId: string,
  events: readonly (Record<string, unknown> & { id: string })[],
): Promise<readonly Record<string, unknown>[]> {
  if (events.length === 0) {
    return [];
  }
  const rows = requireRows<{
    financial_event_id: string;
    member_id: string;
    allocated_cents: number;
  }>(
    "financial allocations",
    await supabase
      .from("financial_allocations")
      .select("financial_event_id, member_id, allocated_cents")
      .eq("household_id", householdId)
      .in(
        "financial_event_id",
        events.map((event) => event.id),
      ),
  );
  return events.map((event) => ({
    ...event,
    allocations: rows
      .filter((row) => row.financial_event_id === event.id)
      .map((row) => ({
        memberId: row.member_id,
        allocatedCents: row.allocated_cents,
      })),
  }));
}

export async function readMoneyOverview(input: {
  eventsBefore?: string;
  eventsCursor?: FinancialHistoryCursor;
}): Promise<Record<string, unknown>> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  let eventQuery = supabase
    .from("financial_events")
    .select(
      "id, type, occurred_on, created_at, description, amount_cents, payer_member_id, related_event_id, category_id, note",
    )
    .eq("household_id", member.householdId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    // One extra row so truncation is detectable rather than silent.
    .limit(RECENT_EVENT_LIMIT + 1);
  if (input.eventsBefore !== undefined) {
    eventQuery = eventQuery.lt("occurred_on", input.eventsBefore);
  }
  if (input.eventsCursor)
    eventQuery = eventQuery.or(financialHistoryBefore(input.eventsCursor));
  const [members, ledgerRows, events, drafts, rules] = await Promise.all([
    memberDirectory(supabase, member.householdId),
    fetchAllLedgerRows(supabase, member.householdId),
    eventQuery,
    supabase
      .from("expense_drafts")
      .select(
        "id, source_kind, description, amount_cents, occurred_on, payer_member_id, proposed_allocations",
      )
      .eq("household_id", member.householdId)
      .eq("status", "pending"),
    supabase
      .from("recurring_expense_rules")
      .select(
        "id, description, amount_cents, payer_member_id, schedule_kind, iso_weekday, day_of_month, active, next_occurrence_on",
      )
      .eq("household_id", member.householdId)
      .order("description"),
  ]);
  const balances = deriveMemberBalances(toLedgerEntries(ledgerRows));
  const eventRows = requireRows<Record<string, unknown> & { id: string }>(
    "financial events",
    events,
  );
  const recentEvents = eventRows.slice(0, RECENT_EVENT_LIMIT);
  return {
    viewerMemberId: member.userId,
    balances: members.map((row) => ({
      memberId: row.user_id,
      name: row.display_name,
      balanceCents: balances.get(asMemberId(row.user_id)) ?? 0,
    })),
    balanceExplainer:
      "A positive balanceCents means that member is owed money; negative means they owe.",
    recentEvents: await attachAllocations(
      supabase,
      member.householdId,
      recentEvents,
    ),
    recentEventsTruncated: eventRows.length > RECENT_EVENT_LIMIT,
    nextEventsCursor: nextCursor(
      recentEvents,
      eventRows.length > RECENT_EVENT_LIMIT,
    ),
    pendingExpenseDrafts: requireRows("expense drafts", drafts),
    recurringExpenseRules: requireRows("recurring rules", rules),
  };
}

function nextCursor(
  events: readonly Record<string, unknown>[],
  hasMore: boolean,
): FinancialHistoryCursor | null {
  const last = events.at(-1);
  return hasMore && last
    ? financialHistoryCursor.parse({
        occurredOn: last.occurred_on,
        createdAt: last.created_at,
        id: last.id,
      })
    : null;
}
