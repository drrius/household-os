import fc from "fast-check";
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

import { postManualExpense, postRefund } from "@/lib/money/commands";

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

describe("record_expense", () => {
  it("resolves an equal split into exact allocations with today as default", async () => {
    const input = parseToolInput("record_expense", {
      description: "Coffee beans",
      amountCents: 2001,
      payerMemberId: PAYER,
      split: { kind: "equal" },
    });
    await financialHandler("record_expense")(input, context);
    expect(postManualExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 2001,
        occurredOn: "2026-08-30",
        allocations: [
          { memberId: PAYER, allocatedCents: 1001 },
          { memberId: OTHER, allocatedCents: 1000 },
        ],
      }),
    );
  });

  it("equal-split allocations always cover the exact amount, odd centime to the payer", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000_000 }),
        async (amountCents) => {
          vi.mocked(postManualExpense).mockClear();
          const input = parseToolInput("record_expense", {
            description: "Property expense",
            amountCents,
            payerMemberId: PAYER,
            split: { kind: "equal" },
          });
          await financialHandler("record_expense")(input, context);
          const call = vi.mocked(postManualExpense).mock.calls.at(0)?.[0] as {
            allocations: readonly {
              memberId: string;
              allocatedCents: number;
            }[];
          };
          const total = call.allocations.reduce(
            (sum, item) => sum + item.allocatedCents,
            0,
          );
          expect(total).toBe(amountCents);
          const payerShare = call.allocations.find(
            (item) => item.memberId === PAYER,
          );
          expect(payerShare?.allocatedCents).toBe(Math.ceil(amountCents / 2));
          for (const item of call.allocations) {
            expect(Number.isSafeInteger(item.allocatedCents)).toBe(true);
            expect(item.allocatedCents).toBeGreaterThanOrEqual(0);
          }
        },
      ),
    );
  });

  it("rejects non-positive and fractional centime amounts at the schema", () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -10_000, max: 0 }),
          fc.double({ noInteger: true, noNaN: true, min: 0.5, max: 1e6 }),
        ),
        (amountCents) => {
          const definition = getAiToolDefinition("record_expense");
          const result = definition?.inputSchema.safeParse({
            description: "Bad amount",
            amountCents,
            payerMemberId: PAYER,
            split: { kind: "equal" },
          });
          expect(result?.success).toBe(false);
        },
      ),
    );
  });
});

describe("record_refund", () => {
  it("refuses an equal split at the schema, before any approval", () => {
    const definition = getAiToolDefinition("record_refund");
    const result = definition?.inputSchema.safeParse({
      relatedEventId: EVENT,
      description: "Refund",
      amountCents: 500,
      split: { kind: "equal" },
    });
    expect(result?.success).toBe(false);
  });

  it("passes custom allocations through to the refund command", async () => {
    const input = parseToolInput("record_refund", {
      relatedEventId: EVENT,
      payerMemberId: PAYER,
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
    await financialHandler("record_refund")(input, context);
    expect(postRefund).toHaveBeenCalledWith(
      expect.objectContaining({
        relatedEventId: EVENT,
        allocations: [
          { memberId: PAYER, allocatedCents: 600 },
          { memberId: OTHER, allocatedCents: 300 },
        ],
      }),
    );
  });
});
