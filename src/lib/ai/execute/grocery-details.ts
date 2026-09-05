import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { buyGroceryAgain } from "@/lib/groceries/item-commands";
import { parseGroceryForm } from "@/lib/forms/grocery";
import { cancelShoppingSessionAction } from "@/app/(product)/_actions/groceries";
import { updateGroceryItem } from "@/lib/groceries/item-commands";
import { mergeGroceryItems } from "@/lib/groceries/commands";
import { groceryDetailSchemas as schemas } from "../definitions/grocery-detail-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
export const GROCERY_DETAIL_HANDLERS: Record<string, AiWriteHandler> = {
  buy_grocery_again: async (input, { idempotencyKey }) => {
    const { itemId } = schemas.buy_grocery_again.parse(input);
    const { householdId } = await requireMemberContext();
    return buyGroceryAgain(
      itemId,
      invocationRecordId(`${householdId}:${idempotencyKey}`),
    );
  },
  update_grocery_item: async (input) => {
    const value = schemas.update_grocery_item.parse(input);
    await updateGroceryItem({
      ...value,
      ...parseGroceryForm(commandForm(value)),
    });
    return { itemId: value.itemId };
  },
  merge_grocery_items: (input, { idempotencyKey }) => {
    const value = schemas.merge_grocery_items.parse(input);
    return mergeGroceryItems({
      keepItemId: value.keepItemId,
      removeItemId: value.removeItemId,
      resolvedName: value.name,
      resolvedQuantity: value.quantity,
      resolvedUnit: value.unit,
      resolvedCategoryId: value.categoryId,
      resolvedNote: value.note,
      resolvedSortOrder: value.sortOrder,
      idempotencyKey,
    });
  },
  cancel_shopping_session: async (input) => {
    const value = schemas.cancel_shopping_session.parse(input);
    return { status: await cancelShoppingSessionAction(commandForm(value)) };
  },
};
