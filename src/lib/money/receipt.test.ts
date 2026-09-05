import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const client = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => client }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: async () => ({
    householdId: "10000000-0000-4000-8000-000000000001",
    userId: "00000000-0000-4000-8000-000000000001",
  }),
}));
import { confirmExpenseDraft } from "@/lib/money/commands";
import { validateReceiptPath } from "@/lib/money/receipt";
const household = "10000000-0000-4000-8000-000000000001";
const path = `${household}/receipts/00000000-0000-4000-8000-000000000003.jpg`;
function row(data: unknown) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue({ data, error: null }),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  return query;
}
beforeEach(() => {
  vi.clearAllMocks();
  client.rpc.mockResolvedValue({
    data: { financial_event_id: "expense" },
    error: null,
  });
});
describe("shopping receipt continuity", () => {
  it("carries the household-scoped shopping receipt into a quick draft confirmation", async () => {
    const draft = row({ shopping_session_id: "session" });
    const shopping = row({ receipt_path: path });
    client.from.mockReturnValueOnce(draft).mockReturnValueOnce(shopping);
    await confirmExpenseDraft({
      draftId: "draft",
      idempotencyKey: "stable-key",
    });
    expect(draft.eq).toHaveBeenCalledWith("household_id", household);
    expect(shopping.eq).toHaveBeenCalledWith("household_id", household);
    expect(client.rpc).toHaveBeenCalledWith(
      "confirm_expense_draft",
      expect.objectContaining({
        p_receipt_path: path,
        p_idempotency_key: "stable-key",
      }),
    );
  });
  it("preserves an explicit removal and rejects a receipt from another household before posting", async () => {
    await confirmExpenseDraft({
      draftId: "draft",
      idempotencyKey: "key",
      receiptPath: null,
    });
    expect(client.from).not.toHaveBeenCalled();
    expect(client.rpc).toHaveBeenCalledWith(
      "confirm_expense_draft",
      expect.objectContaining({ p_receipt_path: null }),
    );
    expect(() =>
      validateReceiptPath(
        path.replace(household, "10000000-0000-4000-8000-000000000002"),
        household,
      ),
    ).toThrow(/household/);
    expect(() =>
      validateReceiptPath("https://example.com/receipt.jpg", household),
    ).toThrow();
  });
});
