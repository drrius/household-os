import { beforeEach, expect, it, vi } from "vitest";
import fc from "fast-check";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { loadCostContext, parseCostContextPage } from "./cost-context";
const id = "00000000-0000-4000-8000-000000000301";
const snapshot = {
  paid_cents: "18014398509481982",
  event_count: "2",
  events: [],
  next_cursor: null,
};
beforeEach(() => vi.clearAllMocks());
it("preserves exact totals above JavaScript's safe integer range", () => {
  expect(BigInt(parseCostContextPage(snapshot).paid_cents)).toBe(
    18014398509481982n,
  );
  expect(() =>
    parseCostContextPage({ ...snapshot, paid_cents: 18014398509481982 }),
  ).toThrow();
  expect(() =>
    parseCostContextPage({ ...snapshot, paid_cents: "18.50" }),
  ).toThrow();
});
it("round-trips arbitrarily large positive and negative integer aggregates", () => {
  fc.assert(
    fc.property(fc.bigInt({ min: -(10n ** 35n), max: 10n ** 35n }), (total) => {
      const page = parseCostContextPage({
        ...snapshot,
        paid_cents: total.toString(),
      });
      expect(BigInt(page.paid_cents)).toBe(total);
    }),
  );
});
it("passes the booking filter and complete cursor without truncating amounts", async () => {
  mocks.member.mockResolvedValue({ householdId: id });
  mocks.rpc.mockResolvedValue({ data: snapshot, error: null });
  expect(
    await loadCostContext("project", id, {
      pageSize: 20,
      before: { occurred_on: "2026-09-01", id },
      bookingId: id,
    }),
  ).toEqual(snapshot);
  expect(mocks.rpc).toHaveBeenCalledWith("read_household_cost_context", {
    p_context_kind: "project",
    p_context_id: id,
    p_page_size: 20,
    p_before_on: "2026-09-01",
    p_before_id: id,
    p_booking_id: id,
  });
});
it("authenticates before any cost query", async () => {
  mocks.member.mockRejectedValue(new Error("Sign in"));
  await expect(loadCostContext("asset", id)).rejects.toThrow("Sign in");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("fails visibly on malformed or failed results instead of showing partial totals", async () => {
  mocks.member.mockResolvedValue({ householdId: id });
  mocks.rpc.mockResolvedValueOnce({
    data: null,
    error: { message: "private database detail" },
  });
  await expect(loadCostContext("commitment", id)).rejects.toThrow(
    "Could not load these costs",
  );
  mocks.rpc.mockResolvedValueOnce({
    data: { ...snapshot, paid_cents: null },
    error: null,
  });
  await expect(loadCostContext("commitment", id)).rejects.toThrow();
});
