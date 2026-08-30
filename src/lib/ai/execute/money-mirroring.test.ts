import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getAiToolDefinition } from "@/lib/ai/definitions";
import { FINANCIAL_HANDLERS } from "@/lib/ai/execute/money";
import {
  DRAFT_ROW,
  EVENT,
  EVENT_ROW,
  OTHER,
  PAYER,
  refundState,
  resetRefundState,
} from "@/lib/ai/execute/money-fixtures";

vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({
    userId: "11111111-1111-4111-8111-111111111111",
    householdId: "household-1",
    displayName: "Darius",
  })),
}));

vi.mock("@/lib/supabase/server", async () => {
  const fixtures = await import("@/lib/ai/execute/money-fixtures");
  return {
    createClient: vi.fn(async () => ({ from: fixtures.mockFrom })),
  };
});

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
  resetRefundState();
});

import { confirmExpenseDraft, postRefund } from "@/lib/money/commands";

describe("record_refund bindings", () => {
  it("rejects a payer that does not match the source event", async () => {
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      originalDescription: EVENT_ROW.description,
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
      originalDescription: EVENT_ROW.description,
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
      originalDescription: EVENT_ROW.description,
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
    ).rejects.toThrow(/remains refundable/);
  });
});

describe("cumulative refund cap", () => {
  it("refuses a second full refund of the same event", async () => {
    refundState.children = [
      { id: "refund-1", type: "refund", amount_cents: 1600 },
    ];
    refundState.shares = [
      { member_id: PAYER, allocated_cents: 1000 },
      { member_id: OTHER, allocated_cents: 600 },
    ];
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      originalDescription: EVENT_ROW.description,
      payerMemberId: PAYER,
      description: "Second refund",
      amountCents: 1600,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 1000 },
          { memberId: OTHER, allocatedCents: 600 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/CHF 0\.00 of this event remains refundable/);
    expect(postRefund).not.toHaveBeenCalled();
  });

  it("refuses shares beyond a member's remaining allocation", async () => {
    refundState.children = [
      { id: "refund-1", type: "refund", amount_cents: 600 },
    ];
    refundState.shares = [{ member_id: PAYER, allocated_cents: 600 }];
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      originalDescription: EVENT_ROW.description,
      payerMemberId: PAYER,
      description: "Over the member cap",
      amountCents: 600,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 500 },
          { memberId: OTHER, allocatedCents: 100 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/remaining original allocation/);
  });

  it("refuses refunds against a corrected source", async () => {
    refundState.children = [
      { id: "rev-1", type: "reversal", amount_cents: 1600 },
    ];
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      originalDescription: EVENT_ROW.description,
      payerMemberId: PAYER,
      description: "After correction",
      amountCents: 100,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 100 },
          { memberId: OTHER, allocatedCents: 0 },
        ],
      },
    });
    await expect(
      financialHandler("record_refund")(input, context),
    ).rejects.toThrow(/refund its replacement instead/);
  });

  it("allows refunding what a reversed refund gave back", async () => {
    refundState.children = [
      { id: "refund-1", type: "refund", amount_cents: 1600 },
    ];
    refundState.reversals = [{ related_event_id: "refund-1" }];
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      originalDescription: EVENT_ROW.description,
      payerMemberId: PAYER,
      description: "Refund after reversal",
      amountCents: 400,
      split: {
        kind: "custom",
        allocations: [
          { memberId: PAYER, allocatedCents: 300 },
          { memberId: OTHER, allocatedCents: 100 },
        ],
      },
    });
    await financialHandler("record_refund")(input, context);
    expect(postRefund).toHaveBeenCalledWith(
      expect.objectContaining({ amountCents: 400 }),
    );
  });
});

describe("draft payer changes", () => {
  it("refuses a payer override without a replacement split", async () => {
    const input = parseToolInput("confirm_expense_draft", {
      draftId: EVENT,
      description: DRAFT_ROW.description,
      amountCents: 2400,
      payerMemberId: OTHER,
    });
    await expect(
      financialHandler("confirm_expense_draft")(input, context),
    ).rejects.toThrow(/payer also requires a split/);
    expect(confirmExpenseDraft).not.toHaveBeenCalled();
  });
});

describe("correction targets", () => {
  it("refuses replacements for non-expense events", async () => {
    EVENT_ROW.type = "settlement";
    try {
      const input = parseToolInput("correct_financial_event", {
        eventId: EVENT,
        originalDescription: EVENT_ROW.description,
        originalAmountCents: EVENT_ROW.amount_cents,
        replacement: {
          description: "Replaced settlement",
          amountCents: 700,
          payerMemberId: PAYER,
          split: { kind: "equal" },
          occurredOn: "2026-08-30",
        },
      });
      await expect(
        financialHandler("correct_financial_event")(input, context),
      ).rejects.toThrow(/cannot be replaced/);
    } finally {
      EVENT_ROW.type = "expense";
    }
  });
});
