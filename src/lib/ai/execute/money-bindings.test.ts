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
const DRAFT_ROW = { amount_cents: 2400, payer_member_id: PAYER };
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
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                range: () =>
                  Promise.resolve({ data: LEDGER_ROWS, error: null }),
              }),
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

import {
  confirmExpenseDraft,
  correctFinancialEvent,
  postRefund,
  recordSettlement,
} from "@/lib/money/commands";

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

describe("confirm_expense_draft", () => {
  it("requires the amount and payer so the approval card can show them", () => {
    const definition = getAiToolDefinition("confirm_expense_draft");
    const result = definition?.inputSchema.safeParse({ draftId: EVENT });
    expect(result?.success).toBe(false);
  });

  it("refuses an amount change without a replacement split", async () => {
    const input = parseToolInput("confirm_expense_draft", {
      draftId: EVENT,
      amountCents: 2600,
      payerMemberId: PAYER,
    });
    await expect(
      financialHandler("confirm_expense_draft")(input, context),
    ).rejects.toThrow(/requires a split/);
    expect(confirmExpenseDraft).not.toHaveBeenCalled();
  });

  it("confirms with the draft's own amount and stored allocations", async () => {
    const input = parseToolInput("confirm_expense_draft", {
      draftId: EVENT,
      amountCents: 2400,
      payerMemberId: PAYER,
    });
    await financialHandler("confirm_expense_draft")(input, context);
    expect(confirmExpenseDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        draftId: EVENT,
        amountCents: 2400,
        allocations: null,
      }),
    );
  });
});

describe("record_settlement", () => {
  it("rejects a full settlement whose amount no longer matches the balance", async () => {
    const input = parseToolInput("record_settlement", {
      payerMemberId: PAYER,
      amountCents: 800,
      mode: "full",
      description: "Settle up",
    });
    await expect(
      financialHandler("record_settlement")(input, context),
    ).rejects.toThrow(/outstanding balance is CHF 7\.00/);
    expect(recordSettlement).not.toHaveBeenCalled();
  });

  it("posts a matching full settlement as a bound partial amount", async () => {
    const input = parseToolInput("record_settlement", {
      payerMemberId: PAYER,
      amountCents: 700,
      mode: "full",
      description: "Settle up",
    });
    await financialHandler("record_settlement")(input, context);
    // Partial mode makes the locked RPC post exactly the approved amount
    // (or reject), instead of recomputing the balance itself.
    expect(recordSettlement).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 700, mode: "partial" }),
    );
  });
});

describe("correct_financial_event", () => {
  it("resolves the replacement's split and forwards the reversal target", async () => {
    const input = parseToolInput("correct_financial_event", {
      eventId: EVENT,
      originalDescription: EVENT_ROW.description,
      originalAmountCents: EVENT_ROW.amount_cents,
      replacement: {
        description: "Corrected groceries",
        amountCents: 1500,
        payerMemberId: PAYER,
        split: { kind: "equal" },
        occurredOn: "2026-08-29",
      },
    });
    await financialHandler("correct_financial_event")(input, context);
    expect(correctFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: EVENT,
        replacement: expect.objectContaining({
          amountCents: 1500,
          allocations: [
            { memberId: PAYER, allocatedCents: 750 },
            { memberId: OTHER, allocatedCents: 750 },
          ],
          // Omitted metadata carries over from the original event.
          categoryId: EVENT_ROW.category_id,
          note: EVENT_ROW.note,
          receiptPath: EVENT_ROW.receipt_path,
        }),
      }),
    );
  });

  it("supports a bare reversal without a replacement", async () => {
    const input = parseToolInput("correct_financial_event", {
      eventId: EVENT,
      originalDescription: EVENT_ROW.description,
      originalAmountCents: EVENT_ROW.amount_cents,
    });
    await financialHandler("correct_financial_event")(input, context);
    expect(correctFinancialEvent).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: EVENT, replacement: null }),
    );
  });
});

describe("correction source binding", () => {
  it("refuses when the echoed original drifted from the event", async () => {
    const input = parseToolInput("correct_financial_event", {
      eventId: EVENT,
      originalDescription: "Something else",
      originalAmountCents: 999,
    });
    await expect(
      financialHandler("correct_financial_event")(input, context),
    ).rejects.toThrow(/must match the event being corrected/);
    expect(correctFinancialEvent).not.toHaveBeenCalled();
  });
});
