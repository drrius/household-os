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
    await expect(saveLibraryMeal(input)).resolves.toBeUndefined();
    expect(calls).toContainEqual(["eq", "household_id", "our-household"]);
    database([
      { error: { code: "23505" } },
      { data: { name: "Soup", recipe_url: null, notes: null } },
    ]);
    await expect(saveLibraryMeal(input)).rejects.toThrow("Could not save");
  });
  it("rejects editing a missing or inaccessible meal instead of claiming success", async () => {
    database([{ data: null }]);
    await expect(saveLibraryMeal({ ...input, isNew: false })).rejects.toThrow(
      "no longer available",
    );
  });
  it("scopes grocery removal to both its household and saved meal", async () => {
    const calls = database([{}]);
    await removeMealTemplate("meal-id", "template-id");
    expect(calls).toContainEqual(["eq", "household_id", "our-household"]);
    expect(calls).toContainEqual(["eq", "meal_definition_id", "meal-id"]);
    expect(calls).toContainEqual(["eq", "id", "template-id"]);
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
});
