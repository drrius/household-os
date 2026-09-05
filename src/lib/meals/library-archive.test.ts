import { beforeEach, expect, it, vi } from "vitest";
import {
  restoreLibraryMeal,
  loadArchivedLibraryMeals,
  archivedMealPage,
} from "./library-archive";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
const id = "11111111-1111-4111-8111-111111111111";
function database(result: object) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const name of [
    "from",
    "select",
    "update",
    "eq",
    "is",
    "not",
    "order",
    "range",
    "maybeSingle",
  ])
    builder[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return builder;
    };
  builder.then = (resolve: (result: unknown) => void) =>
    resolve({ data: null, error: null, ...result });
  mocks.client.mockResolvedValue({ from: builder.from });
  return calls;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: "our-home" });
});
it("authorizes restore and rejects missing or cross-household rows", async () => {
  let calls = database({ data: { id } });
  await expect(restoreLibraryMeal(id)).resolves.toBe(id);
  expect(calls).toContainEqual(["eq", "household_id", "our-home"]);
  expect(calls).toContainEqual(["update", { archived_at: null }]);
  expect(calls).toContainEqual(["select", "id"]);
  calls = database({ data: null });
  await expect(restoreLibraryMeal(id)).rejects.toThrow("Could not restore");
  expect(calls).toContainEqual(["eq", "id", id]);
  mocks.member.mockRejectedValue(new Error("Sign in"));
  mocks.client.mockClear();
  await expect(restoreLibraryMeal(id)).rejects.toThrow("Sign in");
  expect(mocks.client).not.toHaveBeenCalled();
});
it("paginates only this household's archived meals deterministically", async () => {
  const calls = database({ data: [], count: 41 });
  await expect(loadArchivedLibraryMeals(2)).resolves.toMatchObject({
    page: 2,
    total: 41,
  });
  expect(calls).toContainEqual(["eq", "household_id", "our-home"]);
  expect(calls).toContainEqual(["not", "archived_at", "is", null]);
  expect(calls).toContainEqual(["range", 20, 39]);
  expect(calls).toContainEqual(["order", "id"]);
  expect(
    [undefined, "-2", "2.4", "bad", "Infinity"].map(archivedMealPage),
  ).toEqual([1, 1, 1, 1, 1]);
});
it("reads removed source snapshots only in detail mode while editors remain active-only", async () => {
  const row = {
    id,
    title_snapshot: "Pasta",
    date: "2030-08-06",
    slot: "dinner",
    notes: "Original note",
    recipe_url_snapshot: "https://example.com/old",
    meal_definition_id: null,
    leftover_of_entry_id: null,
    removed_at: "2030-08-05T12:00:00Z",
  };
  let calls = database({ data: row });
  await expect(loadManageMealEntry(id, true)).resolves.toMatchObject({
    title: "Pasta",
    notes: "Original note",
    removedAt: row.removed_at,
  });
  expect(calls).toContainEqual(["eq", "household_id", "our-home"]);
  expect(calls).not.toContainEqual(["is", "removed_at", null]);
  calls = database({ data: null });
  await expect(loadManageMealEntry(id)).resolves.toBeNull();
  expect(calls).toContainEqual(["is", "removed_at", null]);
});
