import { supabase } from "../lib/supabase";
import { formatCentimes } from "../lib/money-format";
import { throwIfAnyQueryFailed } from "../lib/query";
import type { ReadySession, SessionState } from "../session/SessionProvider";
import { useSessionBoundLoad } from "../session/useSessionBoundLoad";
import { mockMoney } from "./mockMoney";
import type { MoneyViewModel } from "./types";

export type MoneyState =
  | { status: "loading" }
  | { status: "error"; message: string; retry: () => void }
  | { status: "signed-out" }
  | { status: "ready"; model: MoneyViewModel };

export function useMoney(session: SessionState): {
  state: MoneyState;
  refresh: () => void;
} {
  return useSessionBoundLoad(session, { model: mockMoney }, loadMoney);
}

function signedLabel(cents: number): string {
  if (cents === 0) return "CHF 0.00";
  const sign = cents > 0 ? "+" : "-";
  return `${sign}${formatCentimes(Math.abs(cents))}`;
}

async function loadMoney(
  session: ReadySession,
): Promise<{ model: MoneyViewModel }> {
  const { householdId, userId } = session;
  const [membersRes, ledgerRes, eventsRes, draftsRes, openingRes] =
    await Promise.all([
      supabase
        .from("household_members")
        .select("user_id, display_name")
        .eq("household_id", householdId),
      supabase
        .from("ledger_entries")
        .select("financial_event_id, member_id, receivable_delta_cents")
        .eq("household_id", householdId)
        .order("created_at", { ascending: false }),
      supabase
        .from("financial_events")
        .select(
          "id, type, occurred_on, description, amount_cents, payer_member_id, created_by_member_id",
        )
        .eq("household_id", householdId)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("expense_drafts")
        .select("id, source_kind, description, amount_cents, occurred_on")
        .eq("household_id", householdId)
        .eq("status", "pending")
        .order("occurred_on", { ascending: false }),
      supabase
        .from("financial_events")
        .select("id")
        .eq("household_id", householdId)
        .eq("type", "opening_balance")
        .limit(1),
    ]);

  throwIfAnyQueryFailed([
    { label: "Members", error: membersRes.error },
    { label: "Ledger", error: ledgerRes.error },
    { label: "Financial events", error: eventsRes.error },
    { label: "Expense drafts", error: draftsRes.error },
    { label: "Opening balance", error: openingRes.error },
  ]);

  const members = (membersRes.data ?? []) as {
    user_id: string;
    display_name: string;
  }[];
  const nameOf = (id: string | null) =>
    members.find((m) => m.user_id === id)?.display_name ?? "?";
  const partner = members.find((m) => m.user_id !== userId);
  const ledger = (ledgerRes.data ?? []) as {
    financial_event_id: string;
    member_id: string;
    receivable_delta_cents: number;
  }[];
  const balanceCents = ledger
    .filter((e) => e.member_id === userId)
    .reduce((sum, e) => sum + e.receivable_delta_cents, 0);
  const deltaByEvent = new Map<string, number>();
  for (const entry of ledger) {
    if (entry.member_id !== userId) continue;
    deltaByEvent.set(
      entry.financial_event_id,
      (deltaByEvent.get(entry.financial_event_id) ?? 0) +
        entry.receivable_delta_cents,
    );
  }

  const events = (eventsRes.data ?? []) as {
    id: string;
    type: string;
    occurred_on: string;
    description: string;
    amount_cents: number;
    payer_member_id: string | null;
    created_by_member_id: string;
  }[];

  return {
    model: {
      hasOpeningBalance: (openingRes.data ?? []).length > 0,
      hero:
        balanceCents === 0 || !partner
          ? { kind: "settled" }
          : {
              kind: balanceCents > 0 ? "partner_owes_you" : "you_owe_partner",
              partnerName: partner.display_name,
              amountLabel: formatCentimes(Math.abs(balanceCents)),
              amountCents: Math.abs(balanceCents),
            },
      drafts: (
        (draftsRes.data ?? []) as {
          id: string;
          source_kind: string;
          description: string;
          amount_cents: number | null;
          occurred_on: string;
        }[]
      ).map((d) => ({
        id: d.id,
        title: d.description,
        amountLabel:
          d.amount_cents == null ? null : formatCentimes(d.amount_cents),
        source: (d.source_kind === "shopping" ? "Shopping" : "Recurring") as
          "Shopping" | "Recurring",
        meta: `Due ${d.occurred_on} · does not count until confirmed`,
      })),
      events: events.map((e) => ({
        id: e.id,
        title: e.description,
        meta: `${nameOf(e.payer_member_id ?? e.created_by_member_id)} · ${e.occurred_on}`,
        amountLabel: formatCentimes(e.amount_cents),
        balanceDeltaLabel: signedLabel(deltaByEvent.get(e.id) ?? 0),
      })),
    },
  };
}
