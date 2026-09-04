import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  from: vi.fn(),
  filters: vi.fn(),
  links: [] as { grocery_item_id: string }[],
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mocks.from }),
}));
import { loadShoppingHistory } from "./shopping-history";
const sessionId = "20000000-0000-4000-8000-000000000071";
const homeId = "10000000-0000-4000-8000-000000000071";
const session = {
  id: sessionId,
  member_id: "member",
  finished_at: "2026-08-01T10:00:00Z",
  cancelled_at: null,
  receipt_total_cents: 12345,
  receipt_path: `${homeId}/receipts/40000000-0000-4000-8000-000000000071.jpg`,
  draft_expense_id: "draft",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.links = [];
  mocks.member.mockResolvedValue({ householdId: homeId, userId: "member" });
  mocks.from.mockImplementation((table: string) => {
    const data =
      table === "shopping_sessions"
        ? session
        : table === "shopping_session_items"
          ? mocks.links
          : table === "household_members"
            ? { display_name: "Alex" }
            : table === "expense_drafts"
              ? {
                  id: "draft",
                  status: "pending",
                  amount_cents: 10000,
                  description: "Groceries",
                }
              : [
                  {
                    id: "item",
                    name: "Bread",
                    quantity: "1",
                    unit: null,
                    note: null,
                  },
                ];
    const result = { data, error: null };
    const query = {
      select: vi.fn(() => query),
      eq: vi.fn((column, value) => {
        mocks.filters(table, column, value);
        return query;
      }),
      not: vi.fn(() => query),
      in: vi.fn((_column, ids) => {
        if (ids.length === 0) throw new Error("Empty in filter");
        return query;
      }),
      maybeSingle: vi.fn(async () => result),
      single: vi.fn(async () => result),
      then: (resolve: (value: unknown) => unknown) =>
        Promise.resolve(result).then(resolve),
    };
    return query;
  });
});
describe("retained shopping history", () => {
  it("skips the item query after retention while keeping receipt, shopper and financial draft", async () => {
    const history = await loadShoppingHistory(sessionId);
    expect(history?.items).toEqual([]);
    expect(history?.session.receipt_path).toBe(session.receipt_path);
    expect(history?.draft?.id).toBe("draft");
    expect(history?.shopperName).toBe("Alex");
    expect(mocks.from).not.toHaveBeenCalledWith("grocery_items");
  });
  it("loads retained items and scopes every data query to the household", async () => {
    mocks.links = [{ grocery_item_id: "item" }];
    expect((await loadShoppingHistory(sessionId))?.items).toHaveLength(1);
    for (const table of [
      "shopping_sessions",
      "shopping_session_items",
      "grocery_items",
      "expense_drafts",
      "household_members",
    ])
      expect(mocks.filters).toHaveBeenCalledWith(table, "household_id", homeId);
  });
  it("rejects malformed links before querying household data", async () => {
    expect(await loadShoppingHistory("not-an-id")).toBeNull();
    expect(mocks.member).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
