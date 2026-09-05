import { beforeEach, expect, it, vi } from "vitest";
import fc from "fast-check";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), member: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { updateRecurringExpenseRule } from "./recurring-commands";
const a = "00000000-0000-4000-8000-000000000001";
const b = "00000000-0000-4000-8000-000000000002";
const input = {
  ruleId: a,
  expectedUpdatedAt: "2026-09-05T00:00:00.123456+00:00",
  householdId: a,
  description: "Rent",
  amountCents: 1001,
  payerMemberId: a,
  allocations: [
    { memberId: a, allocatedCents: 501 },
    { memberId: b, allocatedCents: 500 },
  ],
  schedule: { kind: "monthly" as const, dayOfMonth: 1 },
  nextOccurrenceOn: "2026-10-01",
  idempotencyKey: b,
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: a });
  mocks.rpc.mockResolvedValue({
    data: { recurring_expense_rule_id: a },
    error: null,
  });
});
it("passes the caller's exact edit baseline without replacing it from a fresh read", async () => {
  await updateRecurringExpenseRule(input);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "update_recurring_expense_rule",
    expect.objectContaining({
      p_expected_updated_at: input.expectedUpdatedAt,
      p_idempotency_key: b,
      p_allocations: input.allocations,
    }),
  );
});
it("reports a stale edit without pretending it was saved", async () => {
  mocks.rpc.mockResolvedValue({
    data: null,
    error: { code: "40001", message: "stale" },
  });
  await expect(updateRecurringExpenseRule(input)).rejects.toThrow(
    "This recurring expense changed. Reopen it before saving.",
  );
});
it("keeps integer CHF allocations unchanged through the versioned edit command", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 0, max: 1_000_000_000 }),
      async (total) => {
        const first = Math.ceil(total / 2),
          second = total - first;
        const allocations = [
          { memberId: a, allocatedCents: first },
          { memberId: b, allocatedCents: second },
        ];
        await updateRecurringExpenseRule({
          ...input,
          amountCents: total,
          allocations,
        });
        const payload = mocks.rpc.mock.calls.at(-1)![1];
        expect(payload.p_amount_cents).toBe(first + second);
        expect(payload.p_allocations).toEqual(allocations);
        expect(payload.p_expected_updated_at).toBe(input.expectedUpdatedAt);
      },
    ),
  );
});
