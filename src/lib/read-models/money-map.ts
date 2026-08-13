import { validateExactAllocations } from "@/domain/money/allocations";
import { deriveMemberBalances, explainBalance } from "@/domain/money/balances";
import type {
  FinancialEvent,
  FinancialEventType,
  LedgerEntry,
  MemberId,
} from "@/domain/money/types";
import {
  asCentimeAmount,
  asFinancialEventId,
  asMemberId,
} from "@/domain/money/values";
import { balanceHero } from "@/lib/read-models/balance-hero";
import {
  EXPENSE_DRAFT_BLOCKER_COPY,
  getExpenseDraftReadiness,
} from "@/lib/read-models/expense-draft-readiness";
import type {
  BalanceHero,
  MoneyReadInput,
  MoneyViewModel,
} from "@/lib/read-models/money";
import {
  formatCentimesAsFrancs,
  formatSignedCentimesAsFrancs,
} from "@/lib/ui/franc-display";

type MoneyMemberRow = MoneyReadInput["members"][number];
type MoneyEventRow = MoneyReadInput["events"][number];
type MoneyAllocationRow = MoneyReadInput["allocations"][number];

const eventTypeLabels = {
  opening_balance: "Starting balance",
  expense: "Expense",
  refund: "Refund",
  settlement: "Settlement",
  reversal: "Reversal",
  replacement: "Replacement",
} satisfies Record<FinancialEventType, string>;

const sourceLabels = {
  shopping: "Shopping",
  recurring: "Recurring",
} as const;

const civilDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "Europe/Zurich",
});

function formatCivilDate(isoDate: string): string {
  return civilDateFormatter.format(new Date(`${isoDate}T12:00:00Z`));
}

function toMemberPair(
  rows: readonly MoneyMemberRow[],
): readonly [MemberId, MemberId] {
  const first = rows[0];
  const second = rows[1];
  if (rows.length !== 2 || first === undefined || second === undefined) {
    throw new Error("Money requires exactly two household members");
  }
  return [asMemberId(first.user_id), asMemberId(second.user_id)];
}

function otherMemberId(
  members: readonly [MemberId, MemberId],
  memberId: MemberId,
): MemberId {
  if (members[0] === memberId) return members[1];
  if (members[1] === memberId) return members[0];
  throw new Error(`Unknown payer member: ${memberId}`);
}

function requirePayer(row: MoneyEventRow): MemberId {
  if (row.payer_member_id === null) {
    throw new Error(`Financial event ${row.id} requires a payer`);
  }
  return asMemberId(row.payer_member_id);
}

function exactAllocationsFor(
  row: MoneyEventRow,
  members: readonly [MemberId, MemberId],
  allocations: readonly MoneyAllocationRow[],
) {
  const payerMemberId = requirePayer(row);
  const result = validateExactAllocations(
    row.amount_cents,
    payerMemberId,
    otherMemberId(members, payerMemberId),
    allocations
      .filter(({ financial_event_id }) => financial_event_id === row.id)
      .map((allocation) => ({
        memberId: asMemberId(allocation.member_id),
        allocatedCents: allocation.allocated_cents,
      })),
  );
  if (!result.ok) {
    throw new Error(
      `Invalid allocations for ${row.id}: ${result.error.message}`,
    );
  }
  return result.allocations;
}

function toFinancialEvent(
  row: MoneyEventRow,
  members: readonly [MemberId, MemberId],
  allocations: readonly MoneyAllocationRow[],
  ledgerEntries: readonly LedgerEntry[],
): FinancialEvent {
  const id = asFinancialEventId(row.id);
  const amountCents = asCentimeAmount(row.amount_cents);
  if (row.type === "reversal") {
    if (row.related_event_id === null) {
      throw new Error(`Reversal ${row.id} requires a related event`);
    }
    const relatedEventId = asFinancialEventId(row.related_event_id);
    return {
      id,
      type: row.type,
      amountCents,
      relatedEventId,
      relatedLedgerEntries: ledgerEntries.filter(
        (entry) => entry.financialEventId === relatedEventId,
      ),
    };
  }
  const payerMemberId = requirePayer(row);
  const otherId = otherMemberId(members, payerMemberId);
  if (row.type === "opening_balance" || row.type === "settlement") {
    return {
      id,
      type: row.type,
      amountCents,
      payerMemberId,
      otherMemberId: otherId,
    };
  }
  return {
    id,
    type: row.type,
    amountCents,
    payerMemberId,
    otherMemberId: otherId,
    allocations: exactAllocationsFor(row, members, allocations),
  };
}

/**
 * Names who put the money in, not merely who typed the row. Reversals carry no
 * payer, and an opening balance stores the creditor rather than a payer, so
 * both fall back to the member who recorded the event.
 */
function toEventMeta(
  row: MoneyEventRow,
  memberNameById: ReadonlyMap<string, string>,
): string {
  const occurredOn = formatCivilDate(row.occurred_on);
  const payerName =
    row.payer_member_id === null || row.type === "opening_balance"
      ? undefined
      : memberNameById.get(row.payer_member_id);
  if (payerName !== undefined) {
    return `${payerName} paid · ${occurredOn}`;
  }
  const creatorName = memberNameById.get(row.created_by_member_id) ?? "Someone";
  return `${creatorName} recorded · ${occurredOn}`;
}

/** States a signed balance movement in words, always framed as a receivable. */
function toBalanceEffect(deltaCents: number, partnerName: string): string {
  if (deltaCents === 0) {
    return `No change to what ${partnerName} owes you`;
  }
  const magnitude = formatCentimesAsFrancs(Math.abs(deltaCents));
  return deltaCents > 0
    ? `${partnerName} owes you ${magnitude} more`
    : `${magnitude} off what ${partnerName} owes you`;
}

function toHero(balanceCents: number, partnerName: string): BalanceHero {
  const hero = balanceHero(balanceCents, partnerName);
  if (hero.kind === "settled") return { kind: "settled" };
  return hero;
}

function toEventRows(
  rows: readonly MoneyEventRow[],
  deltaByEventId: ReadonlyMap<string, number>,
  memberNameById: ReadonlyMap<string, string>,
  partnerName: string,
): MoneyViewModel["events"] {
  return [...rows]
    .sort(
      (left, right) =>
        right.occurred_on.localeCompare(left.occurred_on) ||
        right.created_at.localeCompare(left.created_at),
    )
    .slice(0, 20)
    .map((row) => {
      const deltaCents = deltaByEventId.get(row.id) ?? 0;
      return {
        id: row.id,
        title: row.description,
        meta: toEventMeta(row, memberNameById),
        amount: formatCentimesAsFrancs(row.amount_cents),
        balanceDelta: formatSignedCentimesAsFrancs(deltaCents),
        balanceEffect: toBalanceEffect(deltaCents, partnerName),
        type: eventTypeLabels[row.type],
      };
    });
}

function toDraftCards(
  rows: MoneyReadInput["drafts"],
  memberIds: readonly string[],
): MoneyViewModel["drafts"] {
  return rows.map((row) => {
    const readiness = getExpenseDraftReadiness({
      amountCents: row.amount_cents,
      payerMemberId: row.payer_member_id,
      memberIds,
      proposedAllocations: row.proposed_allocations,
    });
    return {
      id: row.id,
      title: row.description,
      amount:
        row.amount_cents === null
          ? null
          : formatCentimesAsFrancs(row.amount_cents),
      meta: `Due ${formatCivilDate(row.occurred_on)} · does not count until confirmed`,
      source: sourceLabels[row.source_kind],
      canConfirm: readiness.ready,
      blocker: readiness.ready
        ? null
        : EXPENSE_DRAFT_BLOCKER_COPY[readiness.blocker],
    };
  });
}

export function mapMoneyViewModel(input: MoneyReadInput): MoneyViewModel {
  const members = toMemberPair(input.members);
  const viewerId = asMemberId(input.viewerId);
  const partner = input.members.find(
    ({ user_id }) => user_id !== input.viewerId,
  );
  if (!members.includes(viewerId) || partner === undefined) {
    throw new Error("Money viewer must be a household member");
  }
  const ledgerEntries = input.ledgerEntries.map((row): LedgerEntry => ({
    financialEventId: asFinancialEventId(row.financial_event_id),
    memberId: asMemberId(row.member_id),
    receivableDeltaCents: row.receivable_delta_cents,
  }));
  const financialEvents = input.events.map((row) =>
    toFinancialEvent(row, members, input.allocations, ledgerEntries),
  );
  const balanceCents = deriveMemberBalances(ledgerEntries).get(viewerId) ?? 0;
  const eventById = new Map(input.events.map((event) => [event.id, event]));
  const contributions =
    explainBalance(ledgerEntries, financialEvents).find(
      ({ memberId }) => memberId === viewerId,
    )?.contributions ?? [];
  const explanation = contributions.map((contribution) => ({
    label:
      eventById.get(contribution.financialEventId)?.description ??
      eventTypeLabels[contribution.eventType],
    delta: formatSignedCentimesAsFrancs(contribution.deltaCents),
  }));
  const deltaByEventId = new Map<string, number>(
    contributions.map((contribution) => [
      contribution.financialEventId,
      contribution.deltaCents,
    ]),
  );
  const memberNameById = new Map(
    input.members.map((member) => [member.user_id, member.display_name]),
  );
  return {
    hasOpeningBalance: input.events.some(
      (event) => event.type === "opening_balance",
    ),
    hero: toHero(balanceCents, partner.display_name),
    explanation,
    drafts: toDraftCards(
      input.drafts,
      input.members.map((member) => member.user_id),
    ),
    events: toEventRows(
      input.events,
      deltaByEventId,
      memberNameById,
      partner.display_name,
    ),
  };
}
