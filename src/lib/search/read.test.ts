import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc: mocks.rpc }),
}));
import { loadHouseholdSearch } from "./read";
import { parseSearchRequest } from "@/domain/search/query";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: "own" });
  mocks.rpc.mockResolvedValue({
    data: { total_count: "0", results: [], next_cursor: null },
    error: null,
  });
});
it("authenticates even an empty search without querying household records", async () => {
  await loadHouseholdSearch(parseSearchRequest({}));
  expect(mocks.member).toHaveBeenCalledOnce();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("refuses an unauthenticated caller before searching", async () => {
  mocks.member.mockRejectedValueOnce(new Error("Sign in"));
  await expect(
    loadHouseholdSearch(parseSearchRequest({ q: "holiday" })),
  ).rejects.toThrow("Sign in");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("passes only validated search criteria with bounded paging and no caller-supplied tenant", async () => {
  await loadHouseholdSearch(
    parseSearchRequest({ q: "summer holiday", type: "trip", archived: "1" }),
  );
  expect(mocks.rpc).toHaveBeenCalledWith("search_household", {
    p_query: "summer holiday",
    p_types: ["trip"],
    p_include_archived: true,
    p_page_size: 25,
    p_after_score: null,
    p_after_kind: null,
    p_after_id: null,
  });
});
it("does not execute invalid input and reports read failures rather than fake empty success", async () => {
  await loadHouseholdSearch(parseSearchRequest({ q: "x".repeat(121) }));
  expect(mocks.rpc).not.toHaveBeenCalled();
  mocks.rpc.mockResolvedValueOnce({ error: { message: "private SQL detail" } });
  await expect(
    loadHouseholdSearch(parseSearchRequest({ q: "holiday" })),
  ).rejects.toThrow("Search couldn't load your household");
});

it("uses database character semantics before invoking the search RPC", async () => {
  await loadHouseholdSearch(parseSearchRequest({ q: "😀" }));
  expect(mocks.rpc).not.toHaveBeenCalled();
  await loadHouseholdSearch(parseSearchRequest({ q: "😀".repeat(120) }));
  expect(mocks.rpc).toHaveBeenCalledOnce();
  expect(mocks.rpc.mock.calls[0]?.[1].p_query).toBe("😀".repeat(120));
});
