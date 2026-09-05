import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mock.client }));
import { saveBooking, archiveBooking } from "./commands";
import { parseBookingForm } from "./forms";
const id = "36000000-0000-4000-8000-000000000020";
function input(version: string | null = null) {
  const form = new FormData();
  Object.entries({
    id,
    project_id: id,
    title: "Flight",
    kind: "flight",
    time_zone: "Europe/Zurich",
    end_time_zone: "Europe/Zurich",
    updatedAt: version ?? "",
  }).forEach(([k, v]) => form.set(k, v));
  return parseBookingForm(form);
}
function database(results: unknown[]) {
  const calls: unknown[][] = [];
  const query: Record<string, unknown> = {};
  for (const method of [
    "from",
    "select",
    "insert",
    "update",
    "eq",
    "is",
    "maybeSingle",
  ])
    query[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return query;
    };
  query.then = (resolve: (value: unknown) => void) => resolve(results.shift());
  mock.client.mockResolvedValue({ from: query.from });
  return calls;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.member.mockResolvedValue({ householdId: "household", userId: "member" });
});
it("binds edits to household, trip, version and active lifecycle", async () => {
  const edit = input("2026-09-05T00:00:00Z");
  const calls = database([{ data: null, error: null }]);
  await expect(saveBooking(edit)).rejects.toThrow("Reload");
  for (const [key, value] of [
    ["household_id", "household"],
    ["project_id", id],
    ["updated_at", edit.version],
  ])
    expect(calls).toContainEqual(["eq", key, value]);
  expect(calls).toContainEqual(["is", "archived_at", null]);
});
it("acknowledges only unchanged active creation retries", async () => {
  const create = input();
  database([
    { error: { code: "23505" } },
    {
      data: { ...create.fields, archived_at: null, calendar_event_id: null },
      error: null,
    },
  ]);
  await expect(saveBooking(create)).resolves.toBeUndefined();
  database([
    { error: { code: "23505" } },
    {
      data: {
        ...create.fields,
        archived_at: "archived",
        calendar_event_id: null,
      },
      error: null,
    },
  ]);
  await expect(saveBooking(create)).rejects.toThrow(
    "already created and has changed",
  );
});
it("authenticates archive and save before accessing persistence", async () => {
  mock.member.mockRejectedValue(new Error("Sign in"));
  await expect(saveBooking(input())).rejects.toThrow("Sign in");
  await expect(archiveBooking(id, id, "version", true)).rejects.toThrow(
    "Sign in",
  );
  expect(mock.client).not.toHaveBeenCalled();
});
