import fc from "fast-check";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: vi.fn(async () => ({ householdId: "household-1" })),
}));
vi.mock("@/lib/connected/cost-records", () => ({ loadCostRecord: vi.fn() }));
vi.mock("@/lib/connected/context-expense-command", () => ({
  postContextualExpense: vi.fn(async () => ({ eventId: "posted" })),
}));
vi.mock("@/lib/connected/cost-associations", () => ({
  assignExpenseContext: vi.fn(),
}));
import { loadCostRecord } from "@/lib/connected/cost-records";
import { postContextualExpense } from "@/lib/connected/context-expense-command";
import { assignExpenseContext } from "@/lib/connected/cost-associations";
import { COST_HANDLERS } from "./costs";

const id = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const context = {
  idempotencyKey: "ai:record_contextual_expense:call-1",
  today: "2026-09-05",
};
const expense = {
  target: { kind: "project", id },
  contextTitle: "Summer trip",
  bookingTitle: null,
  description: "Train tickets",
  amountCents: 101,
  payerMemberId: id,
  split: {
    kind: "custom",
    allocations: [
      { memberId: id, allocatedCents: 51 },
      { memberId: other, allocatedCents: 50 },
    ],
  },
  occurredOn: "2026-09-05",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCostRecord).mockResolvedValue({
    record: { id, title: "Summer trip", archived_at: null },
    booking: null,
  });
});
describe("contextual expense approval", () => {
  it("posts the approved amount and allocations with a stable retry key", async () => {
    await COST_HANDLERS.record_contextual_expense!(expense, context);
    expect(postContextualExpense).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 101,
        allocations: expense.split.allocations,
        idempotencyKey: context.idempotencyKey,
        contextId: id,
        contextKind: "project",
      }),
    );
  });
  it.each(["different title", "missing booking"])(
    "rejects stale approval: %s",
    async (change) => {
      const input = {
        ...expense,
        ...(change === "different title"
          ? { contextTitle: "Winter trip" }
          : { bookingTitle: "Hotel" }),
      };
      await expect(
        COST_HANDLERS.record_contextual_expense!(input, context),
      ).rejects.toThrow("context changed");
      expect(postContextualExpense).not.toHaveBeenCalled();
    },
  );
  it("preserves every approved integer centime and custom share", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 1, max: 10_000_000 }),
        async (amountCents) => {
          const allocations = [
            { memberId: id, allocatedCents: amountCents - 1 },
            { memberId: other, allocatedCents: 1 },
          ];
          await COST_HANDLERS.record_contextual_expense!(
            { ...expense, amountCents, split: { kind: "custom", allocations } },
            context,
          );
          const posted = vi.mocked(postContextualExpense).mock.calls.at(-1)![0];
          expect(posted.amountCents).toBe(amountCents);
          expect(posted.allocations).toEqual(allocations);
          expect(
            posted.allocations.reduce(
              (sum, allocation) => sum + allocation.allocatedCents,
              0,
            ),
          ).toBe(amountCents);
        },
      ),
      { numRuns: 50 },
    );
  });
  it("rejects a split that does not match the approved total", async () => {
    await expect(
      COST_HANDLERS.record_contextual_expense!(
        { ...expense, amountCents: 100 },
        context,
      ),
    ).rejects.toThrow();
    expect(postContextualExpense).not.toHaveBeenCalled();
  });
  it("retries unlinking with the same request ID and expected revision", async () => {
    const input = { eventId: id, expectedRevision: other, target: null };
    await COST_HANDLERS.assign_expense_context!(input, context);
    await COST_HANDLERS.assign_expense_context!(input, context);
    const calls = vi.mocked(assignExpenseContext).mock.calls;
    expect(calls[0]![0]).toEqual(calls[1]![0]);
    expect(calls[0]![0]).toMatchObject(input);
    expect(postContextualExpense).not.toHaveBeenCalled();
  });
});
