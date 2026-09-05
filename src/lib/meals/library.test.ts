import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  saveLibraryMeal,
  saveMealTemplate,
  removeMealTemplate,
} from "./library";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({ member: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));

const input = {
  id: "11111111-1111-4111-8111-111111111111",
  sourceEntryId: null,
  version: null,
  isNew: true,
  name: "Pasta",
  recipeUrl: null,
  notes: null,
};

function database(results: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Array<[string, ...unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const name of [
    "from",
    "insert",
    "update",
    "delete",
    "select",
    "eq",
    "is",
    "order",
    "limit",
    "maybeSingle",
  ])
    builder[name] = (...args: unknown[]) => {
      calls.push([name, ...args]);
      return builder;
    };
  builder.then = (resolve: (result: unknown) => void) => {
    const result = results.shift();
    if (!result) throw new Error("Unexpected database request");
    resolve({ data: null, error: null, ...result });
  };
  mocks.client.mockResolvedValue({ from: builder.from });
  return calls;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: "our-household" });
});

describe("saved meal persistence", () => {
  it("authenticates before accessing persistence", async () => {
    mocks.member.mockRejectedValue(new Error("Not signed in"));
    await expect(saveLibraryMeal(input)).rejects.toThrow("Not signed in");
    await expect(removeMealTemplate(input.id, input.id)).rejects.toThrow(
      "Not signed in",
    );
    expect(mocks.client).not.toHaveBeenCalled();
  });
  it("accepts a retry only when the saved payload belongs to this household and matches", async () => {
    const calls = database([
      { error: { code: "23505" } },
      { data: { name: "Pasta", recipe_url: null, notes: null } },
    ]);
    await expect(saveLibraryMeal(input)).resolves.toBe(input.id);
    expect(calls).toContainEqual(["eq", "household_id", "our-household"]);
    database([
      { error: { code: "23505" } },
      { data: { name: "Soup", recipe_url: null, notes: null } },
    ]);
    await expect(saveLibraryMeal(input)).rejects.toThrow("Could not save");
  });
  it("rejects editing a missing or inaccessible meal instead of claiming success", async () => {
    database([{ data: null }]);
    await expect(
      saveLibraryMeal({
        ...input,
        isNew: false,
        version: "2026-09-05T00:00:00Z",
      }),
    ).rejects.toThrow("no longer available");
  });
  it("scopes grocery removal to both its household and saved meal", async () => {
    const calls = database([{}]);
    await removeMealTemplate("meal-id", "template-id");
    expect(calls).toContainEqual(["eq", "household_id", "our-household"]);
    expect(calls).toContainEqual(["eq", "meal_definition_id", "meal-id"]);
    expect(calls).toContainEqual(["eq", "id", "template-id"]);
    expect(calls.some(([method]) => method === "delete")).toBe(false);
    expect(calls).toContainEqual([
      "update",
      { archived_at: expect.any(String) },
    ]);
  });
  it("cannot add a default grocery to an unavailable saved meal", async () => {
    const calls = database([{ data: null }]);
    await expect(
      saveMealTemplate({
        ...input,
        libraryId: input.id,
        quantity: null,
        unit: null,
        categoryId: null,
        note: null,
      }),
    ).rejects.toThrow("no longer available");
    expect(calls.some(([method]) => method === "insert")).toBe(false);
  });
  it("saves a source entry through the atomic linking command and follows the existing result", async () => {
    const existingId = "22222222-2222-4222-8222-222222222222";
    const rpc = vi.fn().mockResolvedValue({
      data: { meal_definition_id: existingId },
      error: null,
    });
    mocks.client.mockResolvedValue({ rpc });
    await expect(
      saveLibraryMeal({ ...input, sourceEntryId: input.id }),
    ).resolves.toBe(existingId);
    expect(rpc).toHaveBeenCalledWith(
      "save_planned_meal_to_library",
      expect.objectContaining({
        p_entry_id: input.id,
        p_definition_id: input.id,
      }),
    );
  });
});

it("keeps a saved-meal edit bound to the household and version the editor opened", async () => {
  const version = "2026-09-05T00:00:00Z";
  const calls = database([{ data: { id: input.id } }]);
  await expect(
    saveLibraryMeal({ ...input, isNew: false, version }),
  ).resolves.toBe(input.id);
  expect(calls).toContainEqual(["eq", "updated_at", version]);
  expect(calls).toContainEqual(["eq", "household_id", "our-household"]);
  database([{ data: null }]);
  await expect(
    saveLibraryMeal({ ...input, isNew: false, version }),
  ).rejects.toThrow("Reload it before saving");
});

it("rejects a stale default-grocery edit without replacing the partner's data", async () => {
  const edit = {
    ...input,
    isNew: false,
    version: "2026-09-05T12:00:00.123456+00:00",
    libraryId: input.id,
    quantity: null,
    unit: null,
    categoryId: null,
    note: null,
  };
  const calls = database([{ data: { id: input.id } }, { data: null }]);
  await expect(saveMealTemplate(edit)).rejects.toThrow("Reload the saved meal");
  const updateIndex = calls.findIndex(([method]) => method === "update");
  expect(updateIndex).toBeGreaterThanOrEqual(0);
  const updateCalls = calls.slice(updateIndex);
  expect(updateCalls).toContainEqual(["eq", "updated_at", edit.version]);
  expect(updateCalls).toContainEqual(["eq", "household_id", "our-household"]);
  expect(updateCalls).toContainEqual(["eq", "meal_definition_id", input.id]);
  expect(updateCalls).toContainEqual(["eq", "id", input.id]);
  expect(updateCalls).toContainEqual(["is", "archived_at", null]);
});
