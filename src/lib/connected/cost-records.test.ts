import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  from: vi.fn(),
  results: [] as unknown[],
  chains: [] as Record<string, ReturnType<typeof vi.fn>>[],
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ from: mock.from }),
}));
import { loadCostRecord, loadCostRecords } from "./cost-records";
const id = "00000000-0000-4000-8000-000000000001",
  householdId = "00000000-0000-4000-8000-000000000099";
beforeEach(() => {
  vi.clearAllMocks();
  mock.results = [];
  mock.chains = [];
  mock.member.mockResolvedValue({ householdId });
  mock.from.mockImplementation(() => {
    const result = mock.results.shift();
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    for (const method of ["select", "eq", "is", "not", "order"])
      chain[method] = vi.fn(() => chain);
    chain.maybeSingle = vi.fn(async () => result);
    chain.range = vi.fn(async () => result);
    mock.chains.push(chain);
    return chain;
  });
});
it("scopes parent and booking to the authenticated household and project", async () => {
  const row = { id, title: "Trip", archived_at: null };
  mock.results.push({ data: row, error: null }, { data: row, error: null });
  expect(await loadCostRecord({ kind: "project", id, bookingId: id })).toEqual({
    record: row,
    booking: row,
  });
  for (const chain of mock.chains)
    expect(chain.eq).toHaveBeenCalledWith("household_id", householdId);
  expect(mock.chains[1]!.eq).toHaveBeenCalledWith("project_id", id);
});
it("does not query bookings for a missing parent and refuses missing booking scope", async () => {
  mock.results.push({ data: null, error: null });
  expect(
    await loadCostRecord({ kind: "project", id, bookingId: id }),
  ).toBeNull();
  expect(mock.from).toHaveBeenCalledTimes(1);
  mock.results.push(
    { data: { id, title: "Trip", archived_at: null }, error: null },
    { data: null, error: null },
  );
  expect(
    await loadCostRecord({ kind: "project", id, bookingId: id }),
  ).toBeNull();
});
it("paginates and filters archived records before rendering", async () => {
  const records = Array.from({ length: 31 }, () => ({
    id,
    title: "Item",
    archived_at: "2026-09-05",
  }));
  mock.results.push({ data: records, error: null });
  const result = await loadCostRecords("asset", true, 2);
  expect(result.records).toHaveLength(30);
  expect(result.hasMore).toBe(true);
  expect(mock.chains[0]!.not).toHaveBeenCalledWith("archived_at", "is", null);
  expect(mock.chains[0]!.range).toHaveBeenCalledWith(60, 90);
});
it("fails closed for authentication, invalid selectors and database failures", async () => {
  mock.member.mockRejectedValueOnce(new Error("Sign in"));
  await expect(loadCostRecord({ kind: "asset", id })).rejects.toThrow(
    "Sign in",
  );
  expect(mock.from).not.toHaveBeenCalled();
  await expect(loadCostRecords("asset", false, -1)).rejects.toThrow();
  mock.results.push({ data: null, error: { message: "private" } });
  await expect(loadCostRecords("commitment", false, 0)).rejects.toThrow(
    "Could not load",
  );
});
