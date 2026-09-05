import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
const order = z.number().int().min(0).max(2147483647);
export const categorySchemas = {
  get_grocery_categories: z.object({
    archived: z.boolean().default(false),
    page: z.number().int().min(0).max(10000).default(0),
  }),
  save_grocery_category: z.object({
    identity: z.discriminatedUnion("mode", [
      z.object({ mode: z.literal("create") }),
      z.object({
        mode: z.literal("update"),
        id: uuid,
        previousName: z.string().max(80),
        previousSortOrder: order,
        previousArchivedAt: z.iso.datetime({ offset: true }).nullable(),
      }),
    ]),
    name: z.string().trim().min(1).max(80),
    sortOrder: order,
    archived: z.boolean().default(false),
  }),
};
export const CATEGORY_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_grocery_categories",
    kind: "read",
    inputSchema: categorySchemas.get_grocery_categories,
    description:
      "Read paginated active or archived grocery categories with their current name, order and archive timestamp. Preserve these values as the expected previous state when editing.",
  },
  {
    name: "save_grocery_category",
    kind: "write",
    inputSchema: categorySchemas.save_grocery_category,
    description:
      "Create, rename, reorder, archive or restore a grocery category. New categories start active. For updates use the exact previous values from get_grocery_categories; unchanged fields must be preserved. Creates have stable retry identity.",
  },
];
