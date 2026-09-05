import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
const fields = {
  name: z.string().trim().min(1).max(120),
  quantity: z.string().max(80).nullable(),
  unit: z.string().max(80).nullable(),
  categoryId: uuid.nullable(),
  note: z.string().max(1000).nullable(),
  sortOrder: z.number().int().min(0).max(2147483647),
};
export const groceryDetailSchemas = {
  buy_grocery_again: z.object({ itemId: uuid }),
  update_grocery_item: z.object({
    itemId: uuid,
    updatedAt: z.iso.datetime({ offset: true }),
    ...fields,
  }),
  merge_grocery_items: z
    .object({ keepItemId: uuid, removeItemId: uuid, ...fields })
    .refine(
      (value) => value.keepItemId !== value.removeItemId,
      "Choose two different groceries",
    ),
  cancel_shopping_session: z.object({ sessionId: uuid }),
  get_grocery_history: z.object({
    page: z.number().int().min(0).max(10000).default(0),
  }),
  get_shopping_trip: z.object({ sessionId: uuid }),
};
const descriptions = {
  buy_grocery_again:
    "Add a fresh copy of a purchased grocery from get_grocery_history, preserving its details and using a stable retry identity. Archived categories are cleared.",
  update_grocery_item:
    "Edit an active grocery item with its current updated_at version and sort_order from get_grocery_list. Preserve unchanged fields; claimed items cannot be edited.",
  merge_grocery_items:
    "Merge two duplicate active groceries into the chosen kept item. Read both first and supply the final name, quantity, unit, category, note and sort order explicitly. Do not assume quantities can be added. Uses a stable retry identity.",
  cancel_shopping_session:
    "Cancel the member's shopping session and return its claimed items to the list. If checkout already completed, reports completed instead; never reverses purchases or money.",
  get_grocery_history:
    "Read purchased groceries and completed/cancelled shopping sessions with zero-based paging. Each collection reports whether it has another page. Use IDs for a shopping-trip detail lookup.",
  get_shopping_trip:
    "Read one finished shopping trip, purchased items and associated expense draft or financial event. Receipt metadata is not receipt file contents.",
};
export const GROCERY_DETAIL_TOOLS: readonly AiToolDefinition[] = Object.entries(
  groceryDetailSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name.startsWith("get_") ? "read" : "write",
  description: descriptions[name as keyof typeof descriptions],
}));
