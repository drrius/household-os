import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/app/(product)/_actions/groceries", () => ({
  cancelShoppingSessionAction: vi.fn(),
}));
vi.mock("@/lib/groceries/item-commands", () => ({
  updateGroceryItem: vi.fn(),
}));
vi.mock("@/lib/groceries/commands", () => ({
  mergeGroceryItems: vi.fn(async () => ({ merged: true })),
}));
import { cancelShoppingSessionAction } from "@/app/(product)/_actions/groceries";
import { updateGroceryItem } from "@/lib/groceries/item-commands";
import { mergeGroceryItems } from "@/lib/groceries/commands";
import { GROCERY_DETAIL_HANDLERS } from "./grocery-details";
const id = "11111111-1111-4111-8111-111111111111";
const fields = {
  name: "Milk",
  quantity: "2",
  unit: "litres",
  note: null,
  categoryId: null,
  sortOrder: 12,
};
const context = { idempotencyKey: "ai:merge:one", today: "2026-09-05" };
beforeEach(() => vi.clearAllMocks());
it("preserves grocery order and version while normalizing editable text", async () => {
  await GROCERY_DETAIL_HANDLERS.update_grocery_item!(
    {
      ...fields,
      quantity: " 2 ",
      itemId: id,
      updatedAt: "2026-09-05T10:00:00Z",
    },
    context,
  );
  expect(updateGroceryItem).toHaveBeenCalledWith({
    ...fields,
    itemId: id,
    updatedAt: "2026-09-05T10:00:00Z",
  });
});
it("does not retry a conflicting grocery edit", async () => {
  vi.mocked(updateGroceryItem).mockRejectedValueOnce(
    new Error("This item changed"),
  );
  await expect(
    GROCERY_DETAIL_HANDLERS.update_grocery_item!(
      { ...fields, itemId: id, updatedAt: "2026-09-05T10:00:00Z" },
      context,
    ),
  ).rejects.toThrow("changed");
  expect(updateGroceryItem).toHaveBeenCalledTimes(1);
});
it("rejects merging an item with itself", () => {
  expect(() =>
    GROCERY_DETAIL_HANDLERS.merge_grocery_items!(
      { ...fields, keepItemId: id, removeItemId: id },
      context,
    ),
  ).toThrow("different groceries");
  expect(mergeGroceryItems).not.toHaveBeenCalled();
});
it("reports completed checkout instead of claiming a racing cancellation succeeded", async () => {
  vi.mocked(cancelShoppingSessionAction).mockResolvedValue("completed");
  await expect(
    GROCERY_DETAIL_HANDLERS.cancel_shopping_session!(
      { sessionId: id },
      context,
    ),
  ).resolves.toEqual({ status: "completed" });
});
