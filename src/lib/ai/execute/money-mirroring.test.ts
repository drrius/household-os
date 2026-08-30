import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { FINANCIAL_HANDLERS } from "@/lib/ai/execute/money";

const PAYER = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const EVENT = "33333333-3333-4333-8333-333333333333";

vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({
    userId: PAYER,
    householdId: "household-1",
    displayName: "Darius",
  })),
}));

// The payer owes 700 centimes; the stored draft proposes CHF 24.00.
const LEDGER_ROWS = [
  { financial_event_id: "e1", member_id: PAYER, receivable_delta_cents: -700 },
  { financial_event_id: "e1", member_id: OTHER, receivable_delta_cents: 700 },
];
const DRAFT_ROW = {
  description: "Saturday groceries",
  amount_cents: 2400,
  payer_member_id: PAYER,
};
const EVENT_ALLOCATIONS = [
  { member_id: PAYER, allocated_cents: 1000 },
  { member_id: OTHER, allocated_cents: 600 },
];
const EVENT_ROW = {
  description: "Original groceries",
  amount_cents: 1600,
  payer_member_id: PAYER,
  category_id: "44444444-4444-4444-8444-444444444444",
  note: "original note",
  receipt_path: "receipts/original.jpg",
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    from: (table: string) => {
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
        return {
          select: () => ({
            eq: () => ({
              eq: () =>
                Promise.resolve({ data: EVENT_ALLOCATIONS, error: null }),
            }),
          }),
        };
      }
      if (table === "financial_events") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: EVENT_ROW, error: null }),
              }),
            }),
          }),
        };
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
    },
  })),
}));

vi.mock("@/lib/money/commands", () => ({
  postManualExpense: vi.fn(async (input: unknown) => ({ input })),
  postRefund: vi.fn(async (input: unknown) => ({ input })),
  recordSettlement: vi.fn(async (input: unknown) => ({ input })),
  establishOpeningBalance: vi.fn(async (input: unknown) => ({ input })),
  confirmExpenseDraft: vi.fn(async (input: unknown) => ({ input })),
  correctFinancialEvent: vi.fn(async (input: unknown) => ({ input })),
  createRecurringExpenseRule: vi.fn(async (input: unknown) => ({ input })),
  dismissExpenseDraft: vi.fn(async (input: unknown) => ({ input })),
  setRecurringExpenseRuleActive: vi.fn(async (input: unknown) => ({ input })),
}));

import { confirmExpenseDraft, postRefund } from "@/lib/money/commands";

const context = { idempotencyKey: "ai:test:call-1", today: "2026-08-30" };

function financialHandler(name: string) {
  const handler = FINANCIAL_HANDLERS[name];
  if (handler === undefined) {
    throw new Error(`missing financial handler: ${name}`);
  }
  return handler;
}

function parseToolInput(name: string, raw: unknown): unknown {
  const definition = getAiToolDefinition(name);
  if (definition === null) {
    throw new Error(`missing tool definition: ${name}`);
  }
  return definition.inputSchema.parse(raw);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("record_refund bindings", () => {
  it("rejects a payer that does not match the source event", async () => {
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      payerMemberId: OTHER,
      description: "Refund",
      amountCents: 900,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 600 },
          { memberId: OTHER, allocatedCents: 300 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/original event's payer/);
    expect(postRefund).not.toHaveBeenCalled();
  });

  it("rejects custom splits that do not sum or repeat a member", () => {
    const definition = getAiToolDefinition("record_expense");
    const badSum = definition?.inputSchema.safeParse({
      description: "Bad sum",
      amountCents: 1000,
      payerMemberId: PAYER,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 600 },
          { memberId: OTHER, allocatedCents: 300 },
        ],
      },
    });
    expect(badSum?.success).toBe(false);
    const sameMember = definition?.inputSchema.safeParse({
      description: "Same member",
      amountCents: 900,
      payerMemberId: PAYER,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 600 },
          { memberId: PAYER, allocatedCents: 300 },
        ],
      },
    });
    expect(sameMember?.success).toBe(false);
  });
});

describe("draft and refund mirroring", () => {
  it("refuses a confirmation whose description drifted from the draft", async () => {
    const input = parseToolInput("confirm_expense_draft", {
      draftId: EVENT,
      description: "Some other description",
      amountCents: 2400,
      payerMemberId: PAYER,
    });
    await expect(
      financialHandler("confirm_expense_draft")(input, context),
    ).rejects.toThrow(/must match the stored draft/);
    expect(confirmExpenseDraft).not.toHaveBeenCalled();
  });

  it("refuses refund shares that exceed a member's original allocation", async () => {
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      payerMemberId: PAYER,
      description: "Swapped refund",
      amountCents: 1600,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 600 },
          { memberId: OTHER, allocatedCents: 1000 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/mirror the original shares/);
    expect(postRefund).not.toHaveBeenCalled();
  });

  it("refuses refunds exceeding the original amount", async () => {
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      payerMemberId: PAYER,
      description: "Too big",
      amountCents: 1700,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 1000 },
          { memberId: OTHER, allocatedCents: 700 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/cannot exceed the original/);
  });
});
