import type {
  BalanceContribution,
  FinancialEvent,
  FinancialEventId,
  LedgerEntry,
  MemberBalanceExplanation,
  MemberId,
} from "./types";
import { addSignedCentimes, assertSignedCentimes } from "./values";

export function deriveMemberBalances(
  entries: readonly LedgerEntry[],
): Map<MemberId, number> {
  const balances = new Map<MemberId, number>();
  for (const entry of entries) {
    assertSignedCentimes(entry.receivableDeltaCents, "Ledger delta");
    const balance = addSignedCentimes(
      balances.get(entry.memberId) ?? 0,
      entry.receivableDeltaCents,
      "Member balance",
    );
    balances.set(entry.memberId, balance);
  }
  return balances;
}

function indexEventTypes(
  events: readonly FinancialEvent[],
): Map<FinancialEventId, FinancialEvent["type"]> {
  const eventTypes = new Map<FinancialEventId, FinancialEvent["type"]>();
  for (const event of events) {
    if (eventTypes.has(event.id)) {
      throw new Error(`Duplicate financial event: ${event.id}`);
    }
    eventTypes.set(event.id, event.type);
  }
  return eventTypes;
}

export function explainBalance(
  entries: readonly LedgerEntry[],
  events: readonly FinancialEvent[],
): MemberBalanceExplanation[] {
  const eventTypes = indexEventTypes(events);
  const balances = deriveMemberBalances(entries);
  const contributions = new Map<
    MemberId,
    Map<FinancialEventId, BalanceContribution>
  >();
  for (const entry of entries) {
    const eventType = eventTypes.get(entry.financialEventId);
    if (eventType === undefined) {
      throw new Error(`Missing financial event: ${entry.financialEventId}`);
    }
    const byEvent = contributions.get(entry.memberId) ?? new Map();
    const prior = byEvent.get(entry.financialEventId);
    byEvent.set(entry.financialEventId, {
      financialEventId: entry.financialEventId,
      eventType,
      deltaCents: addSignedCentimes(
        prior?.deltaCents ?? 0,
        entry.receivableDeltaCents,
        "Event contribution",
      ),
    });
    contributions.set(entry.memberId, byEvent);
  }
  return [...balances].map(([memberId, balanceCents]) => ({
    memberId,
    balanceCents,
    contributions: [...(contributions.get(memberId)?.values() ?? [])],
  }));
}
