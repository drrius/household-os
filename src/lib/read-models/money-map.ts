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
import { isExpenseDraftReady } from "@/lib/read-models/expense-draft-readiness";
import type {
  BalanceHero,
  MoneyReadInput,
  MoneyViewModel,
} from "@/lib/read-models/money";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";

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

function toHero(balanceCents: number, partnerName: string): BalanceHero {
  if (balanceCents === 0) return { kind: "settled" };
  const amount = formatCentimesAsFrancs(Math.abs(balanceCents));
  return balanceCents > 0
    ? { kind: "partner_owes_you", partnerName, amount }
    : { kind: "you_owe_partner", partnerName, amount };
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
  const explanation =
    explainBalance(ledgerEntries, financialEvents)
      .find(({ memberId }) => memberId === viewerId)
      ?.contributions.map((contribution) => ({
        label:
          eventById.get(contribution.financialEventId)?.description ??
          eventTypeLabels[contribution.eventType],
        delta: formatCentimesAsFrancs(contribution.deltaCents),
      })) ?? [];
  const memberNameById = new Map(
    input.members.map((member) => [member.user_id, member.display_name]),
  );
  const events = [...input.events]
    .sort(
      (left, right) =>
        right.occurred_on.localeCompare(left.occurred_on) ||
        right.created_at.localeCompare(left.created_at),
    )
    .slice(0, 20)
    .map((event) => ({
      id: event.id,
      title: event.description,
      meta: `${memberNameById.get(event.created_by_member_id) ?? "Household"} · ${formatCivilDate(event.occurred_on)}`,
      amount: formatCentimesAsFrancs(event.amount_cents),
      type: eventTypeLabels[event.type],
    }));
  return {
    hasOpeningBalance: input.events.some(
      (event) => event.type === "opening_balance",
    ),
    hero: toHero(balanceCents, partner.display_name),
    explanation,
    drafts: input.drafts.map((draft) => ({
      id: draft.id,
      title: draft.description,
      amount:
        draft.amount_cents === null
          ? null
          : formatCentimesAsFrancs(draft.amount_cents),
      meta: `Due ${formatCivilDate(draft.occurred_on)}`,
      source: sourceLabels[draft.source_kind],
      canConfirm: isExpenseDraftReady({
        amountCents: draft.amount_cents,
        payerMemberId: draft.payer_member_id,
        memberIds: input.members.map((member) => member.user_id),
        proposedAllocations: draft.proposed_allocations,
      }),
    })),
    events,
  };
}
