import { beforeEach, expect, it, vi } from "vitest";
import fc from "fast-check";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  rpc: vi.fn(),
  client: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.client }));
import {
  postContextualExpense,
  type ContextExpenseInput,
} from "./context-expense-command";
const household = "10000000-0000-4000-8000-000000000028";
const member = "00000000-0000-4000-8000-000000000028";
const other = "00000000-0000-4000-8000-000000000029";
const context = "20000000-0000-4000-8000-000000000028";
const event = "30000000-0000-4000-8000-000000000028";
const input: ContextExpenseInput = {
  description: "Flight",
  amountCents: 101,
  payerMemberId: member,
  allocations: [
    { memberId: member, allocatedCents: 51 },
    { memberId: other, allocatedCents: 50 },
  ],
  occurredOn: "2026-09-05",
  idempotencyKey: "context-1",
  categoryId: null,
  note: "Paid separately",
  contextKind: "project",
  contextId: context,
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.member.mockResolvedValue({ householdId: household, userId: member });
  mock.client.mockResolvedValue({ rpc: mock.rpc });
  mock.rpc.mockResolvedValue({ data: { event_id: event }, error: null });
});
it("posts expense and its booking context through one authorized RPC", async () => {
  const receiptPath = `${household}/receipts/${event}.pdf`;
  expect(
    await postContextualExpense({ ...input, bookingId: event, receiptPath }),
  ).toEqual({ eventId: event });
  expect(mock.rpc).toHaveBeenCalledExactlyOnceWith("post_contextual_expense", {
    p_household_id: household,
    p_description: "Flight",
    p_amount_cents: 101,
    p_payer_member_id: member,
    p_allocations: input.allocations,
    p_occurred_on: input.occurredOn,
    p_idempotency_key: input.idempotencyKey,
    p_context_kind: "project",
    p_context_id: context,
    p_category_id: null,
    p_note: input.note,
    p_receipt_path: receiptPath,
    p_booking_id: event,
  });
});
it("derives the household instead of trusting extra caller properties", async () => {
  await postContextualExpense(
    Object.assign({}, input, { householdId: context }),
  );
  expect(mock.rpc.mock.calls[0]![1]).toMatchObject({
    p_household_id: household,
    p_booking_id: null,
    p_receipt_path: null,
  });
});
it.each(["asset", "commitment"] as const)(
  "accepts %s context and rejects a booking attached to it",
  async (contextKind) => {
    await postContextualExpense({ ...input, contextKind });
    mock.rpc.mockClear();
    await expect(
      postContextualExpense({ ...input, contextKind, bookingId: event }),
    ).rejects.toThrow("Bookings can only");
    expect(mock.rpc).not.toHaveBeenCalled();
  },
);
it.each([
  `${context}/receipts/${event}.pdf`,
  `${household}/documents/${event}.pdf`,
  "../../receipt.pdf",
])("rejects unauthorized receipt path %s before RPC", async (receiptPath) => {
  await expect(
    postContextualExpense({ ...input, receiptPath }),
  ).rejects.toThrow("Upload a receipt");
  expect(mock.rpc).not.toHaveBeenCalled();
});
it("authenticates before opening a client or inspecting identifiers", async () => {
  mock.member.mockRejectedValue(new Error("Sign in"));
  await expect(
    postContextualExpense({ ...input, contextId: "invalid" }),
  ).rejects.toThrow("Sign in");
  expect(mock.client).not.toHaveBeenCalled();
});
it.each(["22023", "42501", "08006"])(
  "explains %s failures without leaking database text or silently retrying",
  async (code) => {
    mock.rpc.mockResolvedValue({
      data: null,
      error: { code, message: "private database detail" },
    });
    await expect(postContextualExpense(input)).rejects.not.toThrow(
      "private database detail",
    );
    expect(mock.rpc).toHaveBeenCalledTimes(1);
  },
);
it.each([null, {}, { event_id: "wrong" }])(
  "does not report success for malformed confirmation %j",
  async (data) => {
    mock.rpc.mockResolvedValue({ data, error: null });
    await expect(postContextualExpense(input)).rejects.toThrow(
      "Retry with the same details",
    );
  },
);
it("preserves exact centimes and allocation sums across the full safe integer range", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: Number.MAX_SAFE_INTEGER }),
      async (amountCents) => {
        const first = Number((BigInt(amountCents) + 1n) / 2n),
          second = amountCents - first;
        const allocations = [
          { memberId: member, allocatedCents: first },
          { memberId: other, allocatedCents: second },
        ];
        await postContextualExpense({ ...input, amountCents, allocations });
        const payload = mock.rpc.mock.lastCall![1];
        expect(payload.p_amount_cents).toBe(amountCents);
        expect(payload.p_allocations).toEqual(allocations);
        expect(BigInt(first) + BigInt(second)).toBe(BigInt(amountCents));
      },
    ),
    { numRuns: 50 },
  );
});
