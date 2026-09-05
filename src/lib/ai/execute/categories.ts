import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { saveGroceryCategory } from "@/lib/groceries/item-commands";
import { categorySchemas } from "../definitions/category-tools";
import { invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
export const CATEGORY_HANDLERS: Record<string, AiWriteHandler> = {
  save_grocery_category: async (input, { idempotencyKey }) => {
    const { identity, name, sortOrder, archived } =
      categorySchemas.save_grocery_category.parse(input);
    const { householdId } = await requireMemberContext();
    if (identity.mode === "create" && archived)
      throw new Error("Create the category as active first.");
    const id =
      identity.mode === "create"
        ? invocationRecordId(`${householdId}:${idempotencyKey}`)
        : identity.id;
    await saveGroceryCategory({
      creationId: identity.mode === "create" ? id : undefined,
      categoryId: identity.mode === "create" ? null : id,
      name,
      sortOrder,
      archive: archived,
      previousName: identity.mode === "update" ? identity.previousName : "",
      previousSortOrder:
        identity.mode === "update" ? identity.previousSortOrder : 0,
      previousArchivedAt:
        identity.mode === "update" ? identity.previousArchivedAt : null,
    });
    return { id };
  },
};
