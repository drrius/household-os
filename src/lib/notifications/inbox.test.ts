import { beforeEach, expect, it, vi } from "vitest";
import { loadInboxFeed, loadInboxPage } from "@/lib/read-models/notifications";
import { markInboxPageRead } from "./inbox-commands";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  client: vi.fn(),
  rpc: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.client }));
const id = "11111111-1111-4111-8111-111111111111";
const second = "11111111-1111-4111-8111-111111111112";
const row = {
  id,
  kind: "partner_notice",
  activity_kind: "expense_posted",
  entity_type: "financial_event",
  entity_id: id,
  payload: {},
  read_at: null,
  created_at: "2026-09-05T12:00:00.123456+00:00",
};
function database(results: object[]) {
  const queries: Array<Array<[string, ...unknown[]]>> = [];
  mock.client.mockResolvedValue({
    rpc: mock.rpc,
    from: (table: string) => {
      const calls: Array<[string, ...unknown[]]> = [["from", table]];
      queries.push(calls);
      const builder: Record<string, unknown> = {};
      for (const name of ["select", "eq", "is", "in", "or", "order", "limit"])
        builder[name] = (...args: unknown[]) => {
          calls.push([name, ...args]);
          return builder;
        };
      builder.then = (resolve: (result: unknown) => void) =>
        resolve({ data: null, error: null, ...results.shift() });
      return builder;
    },
  });
  return queries;
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.member.mockResolvedValue({ householdId: "home", userId: "me" });
  mock.rpc.mockResolvedValue({ data: { marked: 1 }, error: null });
});
it("uses a stable descending keyset, limits IDs to the visible page and counts without fetching all unread IDs", async () => {
  const queries = database([
    { data: [row, { ...row, id: second }] },
    { count: 3000 },
    { count: 5000 },
  ]);
  const feed = await loadInboxPage(
    { filter: "unread", cursor: { createdAt: row.created_at, id: second } },
    1,
  );
  expect(feed).toMatchObject({
    unreadIds: [id],
    unreadCount: 3000,
    totalCount: 5000,
    nextCursor: { createdAt: row.created_at, id },
  });
  expect(queries).toHaveLength(4);
  expect(queries[0]).toContainEqual(["limit", 2]);
  expect(queries[0]).toContainEqual(["order", "id", { ascending: false }]);
  expect(queries[0]).toContainEqual([
    "or",
    `created_at.lt.${row.created_at},and(created_at.eq.${row.created_at},id.lt.${second})`,
  ]);
  for (const query of queries.slice(0, 3)) {
    expect(query).toContainEqual(["eq", "household_id", "home"]);
    expect(query).toContainEqual(["eq", "recipient_member_id", "me"]);
  }
  expect(queries[1]).toContainEqual([
    "select",
    "id",
    { count: "exact", head: true },
  ]);
  expect(queries[2]).toContainEqual([
    "select",
    "id",
    { count: "exact", head: true },
  ]);
});
it("keeps the five-item settings consumer compatible and falls back for a removed target", async () => {
  const queries = database([
    { data: [{ ...row, entity_type: "meal_plan_entry" }] },
    { count: 1 },
    { count: 1 },
    { data: [] },
  ]);
  const feed = await loadInboxFeed(5);
  expect(feed.items[0]?.href).toBe("/plan");
  expect(queries[0]).toContainEqual(["limit", 6]);
  expect(queries[3]).toContainEqual(["is", "removed_at", null]);
  expect(queries[3]).toContainEqual(["in", "id", [id]]);
});
it("authorizes each bounded mark batch and rejects inaccessible items before calling the RPC", async () => {
  let queries = database([{ data: [{ id }] }]);
  await markInboxPageRead([id]);
  expect(queries[0]).toContainEqual(["eq", "recipient_member_id", "me"]);
  expect(queries[0]).toContainEqual(["eq", "household_id", "home"]);
  expect(mock.rpc).toHaveBeenCalledWith("mark_inbox_notifications_read", {
    p_notification_ids: [id],
  });
  mock.rpc.mockClear();
  queries = database([{ data: [] }]);
  await expect(markInboxPageRead([id])).rejects.toThrow("page changed");
  expect(mock.rpc).not.toHaveBeenCalled();
  await expect(markInboxPageRead(Array(41).fill(id))).rejects.toThrow();
  expect(queries).toHaveLength(1);
  mock.member.mockRejectedValue(new Error("Sign in"));
  mock.client.mockClear();
  await expect(markInboxPageRead([id])).rejects.toThrow("Sign in");
  expect(mock.client).not.toHaveBeenCalled();
});
it("reports network errors and concurrent disappearance without claiming success", async () => {
  database([{ data: [{ id }] }]);
  mock.rpc.mockResolvedValue({
    data: null,
    error: { message: "secret backend detail" },
  });
  await expect(markInboxPageRead([id])).rejects.toThrow("Please try again");
  database([{ data: [{ id }] }]);
  mock.rpc.mockResolvedValue({ data: { marked: 0 }, error: null });
  await expect(markInboxPageRead([id])).rejects.toThrow("page changed");
});

it.each([
  ["financial_event", "financial_events", `/money/events/${id}`, "/money"],
  [
    "shopping_session",
    "shopping_sessions",
    `/groceries/shopping/${id}`,
    "/groceries",
  ],
])(
  "opens an accessible %s and falls back when it cannot be resolved",
  async (kind, table, detail, fallback) => {
    for (const target of [
      { data: [{ id }] },
      { data: [] },
      { error: { message: "unavailable" } },
    ]) {
      const queries = database([
        { data: [{ ...row, entity_type: kind }] },
        { count: 1 },
        { count: 1 },
        target,
      ]);
      const feed = await loadInboxFeed();
      expect(feed.items[0]?.href).toBe(target.data?.length ? detail : fallback);
      expect(queries[3]).toContainEqual(["from", table]);
      expect(queries[3]).toContainEqual(["eq", "household_id", "home"]);
      expect(queries[3]).toContainEqual(["in", "id", [id]]);
    }
  },
);
