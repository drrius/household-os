import "server-only";

import { z } from "zod";

import { deriveMemberBalances } from "@/domain/money/balances";
import type { LedgerEntry } from "@/domain/money/types";
import { asFinancialEventId, asMemberId } from "@/domain/money/values";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const optionSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1),
});
const memberSchema = z.object({
  user_id: z.string().uuid(),
  display_name: z.string().trim().min(1),
});

function requireData<T>(
  label: string,
  result: { data: T | null; error: { message: string } | null },
): T {
  if (result.error) throw new Error(`${label} failed: ${result.error.message}`);
  if (result.data === null) throw new Error(`${label} returned no data`);
  return result.data;
}

export async function loadRoutineFormOptions() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [members, areas, pets] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId)
      .order("joined_at"),
    supabase
      .from("areas")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("pets")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("name"),
  ]);
  return {
    members: z.array(memberSchema).parse(requireData("members", members)),
    areas: z.array(optionSchema).parse(requireData("areas", areas)),
    pets: z.array(optionSchema).parse(requireData("pets", pets)),
  };
}

export async function loadGroceryFormOptions() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const result = await supabase
    .from("grocery_categories")
    .select("id, name, is_fallback")
    .eq("household_id", member.householdId)
    .is("archived_at", null)
    .order("sort_order");
  return z
    .array(optionSchema.extend({ is_fallback: z.boolean() }))
    .parse(requireData("grocery categories", result));
}

export async function loadMoneyFormOptions() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [members, categories, opening] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId)
      .order("joined_at"),
    supabase
      .from("expense_categories")
      .select("id, name")
      .eq("household_id", member.householdId)
      .is("archived_at", null)
      .order("sort_order"),
    supabase
      .from("financial_events")
      .select("id")
      .eq("household_id", member.householdId)
      .eq("type", "opening_balance")
      .limit(1),
  ]);
  return {
    members: z.array(memberSchema).parse(requireData("members", members)),
    categories: z
      .array(optionSchema)
      .parse(requireData("expense categories", categories)),
    hasOpeningBalance: requireData("opening balance", opening).length > 0,
  };
}

export type SettlementContext = {
  creditorMemberId: string;
  creditorName: string;
  debtorMemberId: string;
  debtorName: string;
  outstandingCents: number;
};

export async function loadSettlementContext(): Promise<SettlementContext | null> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [membersResult, ledgerResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId)
      .order("joined_at")
      .order("user_id"),
    supabase
      .from("ledger_entries")
      .select("financial_event_id, member_id, receivable_delta_cents")
      .eq("household_id", member.householdId),
  ]);
  const members = z
    .array(memberSchema)
    .parse(requireData("members", membersResult));
  if (members.length !== 2) {
    throw new Error("This household needs exactly two members.");
  }
  if (ledgerResult.error) {
    throw new Error(`settlement_balance failed: ${ledgerResult.error.message}`);
  }
  const entries: LedgerEntry[] = (ledgerResult.data ?? []).map((row) => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
  const balance = deriveMemberBalances(entries);
  const debtor = members.find(
    (row) => (balance.get(asMemberId(row.user_id)) ?? 0) < 0,
  );
  const creditor = members.find(
    (row) => (balance.get(asMemberId(row.user_id)) ?? 0) > 0,
  );
  if (debtor === undefined || creditor === undefined) return null;
  return {
    creditorMemberId: creditor.user_id,
    creditorName: creditor.display_name,
    debtorMemberId: debtor.user_id,
    debtorName: debtor.display_name,
    outstandingCents: Math.abs(balance.get(asMemberId(debtor.user_id)) ?? 0),
  };
}

export async function loadHouseholdSetup() {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("households")
    .select("name")
    .eq("id", member.householdId)
    .single();
  if (error) throw new Error(`household settings failed: ${error.message}`);
  return z.object({ name: z.string().trim().min(1) }).parse(data);
}
