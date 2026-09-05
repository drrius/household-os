import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  client: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: mocks.client }));
vi.mock("@/lib/groceries/commands", () => ({
  createGroceryItem: mocks.create,
}));
import {
  buyGroceryAgain,
  saveGroceryCategory,
  updateGroceryItem,
} from "./item-commands";

function query(result: { data: unknown; error: unknown }) {
  const builder = {
    update: vi.fn(),
    insert: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(result),
    single: vi.fn().mockResolvedValue(result),
  };
  for (const name of ["update", "insert", "select", "eq", "is"] as const)
    builder[name].mockReturnValue(builder);
  return builder;
}
const item = {
  itemId: "item",
  updatedAt: "2026-09-05T12:00:00Z",
  sortOrder: 10,
  name: "Milk",
  quantity: "1",
  unit: "L",
  note: null,
  categoryId: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({ householdId: "home", userId: "me" });
});

describe("grocery item commands", () => {
  it("edits only active items at the version the member actually saw", async () => {
    const builder = query({ data: { id: "item" }, error: null });
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });
    await updateGroceryItem(item);
    expect(builder.eq.mock.calls).toEqual([
      ["id", "item"],
      ["household_id", "home"],
      ["updated_at", item.updatedAt],
      ["state", "active"],
    ]);
    expect(builder.update).toHaveBeenCalledWith({
      name: "Milk",
      quantity: "1",
      unit: "L",
      category_id: null,
      note: null,
      sort_order: 10,
    });
  });

  it("reports concurrent item changes instead of claiming a save succeeded", async () => {
    mocks.client.mockResolvedValue({
      from: vi.fn().mockReturnValue(query({ data: null, error: null })),
    });
    await expect(updateGroceryItem(item)).rejects.toThrow(
      "changed or is already in a cart",
    );
  });

  it("requires fresh category values for archive and rename", async () => {
    const builder = query({ data: null, error: null });
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });
    await expect(
      saveGroceryCategory({
        categoryId: "cat",
        name: "Fresh",
        previousName: "Produce",
        sortOrder: 2,
        previousSortOrder: 1,
        archive: true,
      }),
    ).rejects.toThrow("category changed");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "home");
    expect(builder.eq).toHaveBeenCalledWith("name", "Produce");
    expect(builder.eq).toHaveBeenCalledWith("sort_order", 1);
  });

  it("restores archived categories only if the archived version still matches", async () => {
    const builder = query({ data: { id: "cat" }, error: null });
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });
    await saveGroceryCategory({
      categoryId: "cat",
      name: "Produce",
      previousName: "Produce",
      sortOrder: 1,
      previousSortOrder: 1,
      previousArchivedAt: "2026-09-04T12:00:00Z",
      archive: false,
    });
    expect(builder.eq).toHaveBeenCalledWith(
      "archived_at",
      "2026-09-04T12:00:00Z",
    );
    expect(builder.update).toHaveBeenCalledWith({
      name: "Produce",
      sort_order: 1,
      archived_at: null,
    });
  });

  it("copies purchases into a new item without rewriting financial or purchase history", async () => {
    const builder = query({
      data: {
        name: "Milk",
        quantity: "2",
        unit: "L",
        note: "Oat",
        category_id: null,
      },
      error: null,
    });
    mocks.client.mockResolvedValue({ from: vi.fn().mockReturnValue(builder) });
    await buyGroceryAgain("past-item");
    expect(builder.eq).toHaveBeenCalledWith("state", "purchased");
    expect(builder.eq).toHaveBeenCalledWith("household_id", "home");
    expect(builder.update).not.toHaveBeenCalled();
    expect(mocks.create).toHaveBeenCalledWith({
      name: "Milk",
      quantity: "2",
      unit: "L",
      categoryId: null,
      note: "Oat",
    });
  });
});
