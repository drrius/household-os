import fc from "fast-check";
import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/money/recurring-commands", () => ({
  updateRecurringExpenseRule: vi.fn(),
}));
import { updateRecurringExpenseRule } from "@/lib/money/recurring-commands";
import { RECURRING_HANDLERS } from "./recurring";
const payer = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
const input = {
  ruleId: payer,
  expectedUpdatedAt: "2026-09-05T10:00:00Z",
  description: "Rent",
  amountCents: 101,
  payerMemberId: payer,
  split: {
    kind: "custom",
    allocations: [
      { memberId: payer, allocatedCents: 51 },
      { memberId: other, allocatedCents: 50 },
    ],
  },
  schedule: { kind: "monthly", dayOfMonth: 31 },
  nextOccurrenceOn: "2027-02-28",
  categoryId: null,
};
const context = { idempotencyKey: "ai:recurring:one", today: "2026-09-05" };
beforeEach(() => vi.clearAllMocks());
it("keeps the read revision and stable retry key while accepting clamped month end", async () => {
  await RECURRING_HANDLERS.update_recurring_expense_rule!(input, context);
  expect(updateRecurringExpenseRule).toHaveBeenCalledWith(
    expect.objectContaining({
      expectedUpdatedAt: input.expectedUpdatedAt,
      idempotencyKey: context.idempotencyKey,
      nextOccurrenceOn: "2027-02-28",
      allocations: input.split.allocations,
    }),
  );
});
it("rejects a next date outside the schedule before changing the rule", async () => {
  await expect(
    RECURRING_HANDLERS.update_recurring_expense_rule!(
      { ...input, nextOccurrenceOn: "2027-02-27" },
      context,
    ),
  ).rejects.toThrow("match the rule schedule");
  expect(updateRecurringExpenseRule).not.toHaveBeenCalled();
});
it("propagates stale revision failures without retrying an overwrite", async () => {
  vi.mocked(updateRecurringExpenseRule).mockRejectedValueOnce(
    new Error("This recurring expense changed"),
  );
  await expect(
    RECURRING_HANDLERS.update_recurring_expense_rule!(input, context),
  ).rejects.toThrow("changed");
  expect(updateRecurringExpenseRule).toHaveBeenCalledTimes(1);
});
it("preserves exact custom centime amounts across rule edits", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 10000000 }),
      async (amountCents) => {
        const allocations = [
          { memberId: payer, allocatedCents: amountCents },
          { memberId: other, allocatedCents: 0 },
        ];
        await RECURRING_HANDLERS.update_recurring_expense_rule!(
          { ...input, amountCents, split: { kind: "custom", allocations } },
          context,
        );
        expect(
          vi.mocked(updateRecurringExpenseRule).mock.calls.at(-1)![0],
        ).toMatchObject({ amountCents, allocations });
      },
    ),
    { numRuns: 50 },
  );
});
