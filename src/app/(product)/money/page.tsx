import type { SupabaseClient } from "@supabase/supabase-js";

import { confirmDraftAction } from "@/app/(product)/_actions/money";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  mapMoneyViewModel,
  parseMoneyReadRows,
  type MoneyReadRows,
} from "@/lib/read-models/money";
import { createClient } from "@/lib/supabase/server";
import { MoneyScreen } from "@/ui/money/money-screen";

async function queryMoneyRows(
  client: SupabaseClient,
  householdId: string,
): Promise<MoneyReadRows> {
  const [members, ledgerEntries, events, allocations, drafts] =
    await Promise.all([
      client
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", householdId),
      client
        .from("ledger_entries")
        .select("financial_event_id, member_id, receivable_delta_cents")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }),
      client
        .from("financial_events")
        .select(
          "id, type, occurred_on, created_at, created_by_member_id, payer_member_id, description, amount_cents, related_event_id",
        )
        .eq("household_id", householdId)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
      client
        .from("financial_allocations")
        .select("financial_event_id, member_id, allocated_cents")
        .eq("household_id", householdId),
      client
        .from("expense_drafts")
        .select(
          "id, source_kind, description, amount_cents, occurred_on, payer_member_id, proposed_allocations",
        )
        .eq("household_id", householdId)
        .eq("status", "pending")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);
  const failures: Array<readonly [string, { message: string } | null]> = [
    ["members", members.error],
    ["ledger entries", ledgerEntries.error],
    ["financial events", events.error],
    ["financial allocations", allocations.error],
    ["expense drafts", drafts.error],
  ];
  for (const [label, error] of failures) {
    if (error !== null) {
      throw new Error(`Money ${label} query failed: ${error.message}`);
    }
  }
  return parseMoneyReadRows({
    members: members.data,
    ledgerEntries: ledgerEntries.data,
    events: events.data,
    allocations: allocations.data,
    drafts: drafts.data,
  });
}

export default async function MoneyPage() {
  const member = await requireMemberContext();
  const client = await createClient();
  const rows = await queryMoneyRows(client, member.householdId);
  const model = mapMoneyViewModel({ viewerId: member.userId, ...rows });
  return <MoneyScreen model={model} confirmDraftAction={confirmDraftAction} />;
}
