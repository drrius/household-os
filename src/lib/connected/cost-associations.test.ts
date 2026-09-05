import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  record: vi.fn(),
  results: [] as unknown[],
  chains: [] as Record<string, ReturnType<typeof vi.fn>>[],
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mock.from, rpc: mock.rpc }),
}));
vi.mock("./cost-records", () => ({ loadCostRecord: mock.record }));
import {
  loadAssociationExpenses,
  loadAssociationExpense,
  loadAssociationById,
  assignExpenseContext,
} from "./cost-associations";
const id = "00000000-0000-4000-8000-000000000001",
  householdId = "00000000-0000-4000-8000-000000000099";
const expense = {
  id,
  description: "Flight",
  payer_member_id: id,
  occurred_on: "2026-09-05",
  amount_cents: 101,
  type: "expense",
};
const link = {
  id,
  financial_event_id: id,
  revision: id,
  project_id: id,
  asset_id: null,
  commitment_id: null,
  booking_id: null,
  archived_at: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  mock.results = [];
  mock.chains = [];
  mock.member.mockResolvedValue({ householdId });
  mock.rpc.mockResolvedValue({ data: { event_id: id }, error: null });
  mock.from.mockImplementation(() => {
    const result = mock.results.shift();
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "in", "order", "or"])
      chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => result);
    chain.limit = vi.fn(async () => result);
    mock.chains.push(chain);
    return chain;
  });
});
it("bounds recorded expenses and validates the complete cursor before constructing a filter", async () => {
  mock.results.push({
    data: Array.from({ length: 31 }, () => expense),
    error: null,
  });
  const result = await loadAssociationExpenses({
    beforeOn: "2026-09-05",
    beforeId: id,
  });
  expect(result.expenses).toHaveLength(30);
  expect(result.hasMore).toBe(true);
  expect(mock.chains[0]!.eq).toHaveBeenCalledWith("household_id", householdId);
  expect(mock.chains[0]!.in).toHaveBeenCalledWith("type", [
    "expense",
    "replacement",
  ]);
  expect(mock.chains[0]!.limit).toHaveBeenCalledWith(31);
  expect(mock.chains[0]!.or).toHaveBeenCalledWith(
    `occurred_on.lt.2026-09-05,and(occurred_on.eq.2026-09-05,id.lt.${id})`,
  );
  await expect(
    loadAssociationExpenses({
      beforeOn: "2026-09-05",
      beforeId: "x),id.neq.y",
    }),
  ).rejects.toThrow();
  expect(mock.chains[1]!.or).not.toHaveBeenCalled();
});
it("loads the exact existing association with tenant-scoped expense and link reads", async () => {
  mock.results.push(
    { data: expense, error: null },
    { data: link, error: null },
  );
  mock.record.mockResolvedValue({
    record: { id, title: "Trip", archived_at: null },
    booking: null,
  });
  const result = await loadAssociationExpense(id);
  expect(result?.association?.revision).toBe(id);
  expect(result?.current?.record.title).toBe("Trip");
  for (const query of mock.chains)
    expect(query.eq).toHaveBeenCalledWith("household_id", householdId);
  expect(mock.record).toHaveBeenCalledWith({ kind: "project", id });
});
it("retains an archived link revision without claiming it is an active assignment", async () => {
  mock.results.push(
    { data: expense, error: null },
    { data: { ...link, archived_at: "2026-09-05" }, error: null },
  );
  const result = await loadAssociationExpense(id);
  expect(result?.association?.revision).toBe(id);
  expect(result?.currentTarget).toBeNull();
  expect(mock.record).not.toHaveBeenCalled();
});
it("does not expose a missing or foreign association", async () => {
  mock.results.push({ data: null, error: null });
  expect(await loadAssociationById(id)).toBeNull();
  expect(mock.chains[0]!.eq).toHaveBeenCalledWith("household_id", householdId);
});
it("binds household identity, original revision and request to one atomic command", async () => {
  await assignExpenseContext({
    eventId: id,
    expectedRevision: id,
    requestId: id,
    target: { kind: "project", id, bookingId: id },
  });
  expect(mock.rpc).toHaveBeenCalledWith("assign_expense_context", {
    p_household_id: householdId,
    p_event_id: id,
    p_expected_revision: id,
    p_request_id: id,
    p_context_kind: "project",
    p_context_id: id,
    p_booking_id: id,
  });
  await assignExpenseContext({
    eventId: id,
    expectedRevision: id,
    requestId: id,
    target: null,
  });
  expect(mock.rpc.mock.calls[1]?.[1]).toMatchObject({
    p_context_kind: null,
    p_context_id: null,
    p_booking_id: null,
  });
});
it("rejects stale, invalid and uncertain responses without retrying with a fresh key", async () => {
  const input = {
    eventId: id,
    expectedRevision: id,
    requestId: id,
    target: null,
  };
  for (const code of ["40001", "23505", "22023", "42501", "503"]) {
    mock.rpc.mockResolvedValueOnce({ data: null, error: { code } });
    await expect(assignExpenseContext(input)).rejects.toThrow();
  }
  expect(mock.rpc).toHaveBeenCalledTimes(5);
  await expect(
    assignExpenseContext({ ...input, requestId: "invalid" }),
  ).rejects.toThrow();
  expect(mock.rpc).toHaveBeenCalledTimes(5);
});
