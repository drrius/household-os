/**
 * Shared Supabase stub for the money executor tests. Test files register
 * it inside their own vi.mock factories; the mutable refund state lets
 * individual tests shape prior-refund history and is reset per test.
 */

export const PAYER = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const EVENT = "33333333-3333-4333-8333-333333333333";

// The payer owes 700 centimes; the stored draft proposes CHF 24.00.
export const LEDGER_ROWS = [
  { financial_event_id: "e1", member_id: PAYER, receivable_delta_cents: -700 },
  { financial_event_id: "e1", member_id: OTHER, receivable_delta_cents: 700 },
];
export const DRAFT_ROW = {
  description: "Saturday groceries",
  amount_cents: 2400,
  payer_member_id: PAYER,
};
export const EVENT_ROW = {
  type: "expense",
  description: "Original groceries",
  amount_cents: 1600,
  payer_member_id: PAYER,
  category_id: "44444444-4444-4444-8444-444444444444",
  note: "original note",
  receipt_path: "receipts/original.jpg",
};
export const EVENT_ALLOCATIONS = [
  { member_id: PAYER, allocated_cents: 1000 },
  { member_id: OTHER, allocated_cents: 600 },
];

type ChildEvent = { id: string; type: string; amount_cents: number };
type ReversalRow = { related_event_id: string | null };
type ShareRow = { member_id: string; allocated_cents: number };

export const refundState: {
  children: ChildEvent[];
  reversals: ReversalRow[];
  shares: ShareRow[];
} = { children: [], reversals: [], shares: [] };

export function resetRefundState(): void {
  refundState.children = [];
  refundState.reversals = [];
  refundState.shares = [];
}

export function mockFrom(table: string): unknown {
  if (table === "household_members") {
    return {
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [{ user_id: PAYER }, { user_id: OTHER }],
            error: null,
          }),
      }),
    };
  }
  if (table === "ledger_entries") {
    const chain = {
      order: () => chain,
      range: () => Promise.resolve({ data: LEDGER_ROWS, error: null }),
    };
    return { select: () => ({ eq: () => chain }) };
  }
  if (table === "financial_allocations") {
    const shareChain = {
      order: () => shareChain,
      range: () => Promise.resolve({ data: refundState.shares, error: null }),
    };
    return {
      select: () => ({
        eq: () => ({
          eq: () => Promise.resolve({ data: EVENT_ALLOCATIONS, error: null }),
          in: () => shareChain,
        }),
      }),
    };
  }
  if (table === "financial_events") {
    const chain = {
      eq: () => chain,
      order: () => chain,
      single: () => Promise.resolve({ data: EVENT_ROW, error: null }),
      range: () => Promise.resolve({ data: refundState.children, error: null }),
      in: () => Promise.resolve({ data: refundState.reversals, error: null }),
    };
    return { select: () => chain };
  }
  if (table === "expense_drafts") {
    return {
      select: () => ({
        eq: () => ({
          eq: () => ({
            single: () => Promise.resolve({ data: DRAFT_ROW, error: null }),
          }),
        }),
      }),
    };
  }
  throw new Error(`unexpected table in test: ${table}`);
}
