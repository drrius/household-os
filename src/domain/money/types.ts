export type MemberId = string & { readonly __brand: "MemberId" };
export type FinancialEventId = string & {
  readonly __brand: "FinancialEventId";
};
export type CentimeAmount = number & { readonly __brand: "CentimeAmount" };
export type IsoDate = string & { readonly __brand: "IsoDate" };
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type MonthlyDay = number & { readonly __brand: "MonthlyDay" };

declare const exactAllocationsBrand: unique symbol;

export type FinancialEventType =
  | "opening_balance"
  | "expense"
  | "refund"
  | "settlement"
  | "reversal"
  | "replacement";

export interface FinancialAllocationInput {
  memberId: MemberId;
  allocatedCents: number;
}

export interface FinancialAllocation {
  memberId: MemberId;
  allocatedCents: CentimeAmount;
}

export type ExactAllocations = readonly [
  FinancialAllocation,
  FinancialAllocation,
] & {
  readonly [exactAllocationsBrand]: true;
};

export interface LedgerEntry {
  financialEventId: FinancialEventId;
  memberId: MemberId;
  receivableDeltaCents: number;
}

type IdentifiedEvent = {
  id: FinancialEventId;
  amountCents: CentimeAmount;
};

type TwoMemberEvent = IdentifiedEvent & {
  payerMemberId: MemberId;
  otherMemberId: MemberId;
};

export type OpeningBalanceEvent = TwoMemberEvent & {
  type: "opening_balance";
};

export type ExpenseEvent = TwoMemberEvent & {
  type: "expense";
  allocations: ExactAllocations;
};

export type RefundEvent = TwoMemberEvent & {
  type: "refund";
  allocations: ExactAllocations;
};

export type SettlementEvent = TwoMemberEvent & {
  type: "settlement";
};

export type ReversalEvent = IdentifiedEvent & {
  type: "reversal";
  relatedEventId: FinancialEventId;
  relatedLedgerEntries: readonly LedgerEntry[];
};

export type ReplacementEvent = TwoMemberEvent & {
  type: "replacement";
  allocations: ExactAllocations;
};

export type FinancialEvent =
  | OpeningBalanceEvent
  | ExpenseEvent
  | RefundEvent
  | SettlementEvent
  | ReversalEvent
  | ReplacementEvent;

export type PlannedReversal = Omit<ReversalEvent, "id">;
export type PlannedReplacement = Omit<ReplacementEvent, "id">;

export interface ReplacementPlanInput {
  amountCents: number;
  payerMemberId: MemberId;
  otherMemberId: MemberId;
  allocations: readonly FinancialAllocationInput[];
}

export type RecurringExpenseSchedule =
  | { kind: "weekly"; weekday: IsoWeekday }
  | { kind: "monthly"; dayOfMonth: MonthlyDay };

export interface BalanceContribution {
  financialEventId: FinancialEventId;
  eventType: FinancialEventType;
  deltaCents: number;
}

export interface MemberBalanceExplanation {
  memberId: MemberId;
  balanceCents: number;
  contributions: readonly BalanceContribution[];
}
