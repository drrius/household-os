import { z } from "zod";
import { uuid, webUrl, type AiToolDefinition } from "./schemas";
import { recordIdentity } from "./project-tools";
const optionalText = (max: number) => z.string().max(max).nullable();
export const librarySchemas = {
  get_library_meal: z.object({ libraryId: uuid }),
  get_library_meals: z.object({
    page: z.number().int().min(0).max(10000).default(0),
    archived: z.boolean().default(false),
    query: z.string().trim().max(120).default(""),
  }),
  save_library_meal: z.object({
    identity: recordIdentity,
    name: z.string().trim().min(1).max(120),
    recipeUrl: webUrl.nullable(),
    notes: optionalText(4000),
    sourceEntryId: uuid.nullable().default(null),
  }),
  save_meal_grocery_template: z.object({
    identity: recordIdentity,
    libraryId: uuid,
    name: z.string().trim().min(1).max(120),
    quantity: optionalText(80),
    unit: optionalText(80),
    categoryId: uuid.nullable(),
    note: optionalText(1000),
  }),
  set_library_meal_archived: z.object({
    libraryId: uuid,
    archived: z.boolean(),
  }),
  set_meal_grocery_template_archived: z.object({
    libraryId: uuid,
    templateId: uuid,
    archived: z.boolean(),
  }),
};
const descriptions = {
  get_library_meal:
    "Read a saved meal and active/archived default groceries, including edit versions. These templates are separate from groceries already added to the current list.",
  get_library_meals:
    "Find active or archived saved meals by name, with zero-based pagination and real IDs.",
  save_library_meal:
    "Create or edit a saved meal with its current version. Preserve unchanged values. On creation, sourceEntryId may identify a real planned meal to save to the library; do not supply it for edits.",
  save_meal_grocery_template:
    "Create or edit a saved meal's default grocery using its current version. This changes the template for future use, not the current grocery list. Preserve unchanged values.",
  set_library_meal_archived:
    "Archive or restore a saved meal after reading it. Existing planned meals retain their snapshots.",
  set_meal_grocery_template_archived:
    "Archive or restore one default grocery template within a saved meal. Existing grocery-list items are unaffected.",
};
export const LIBRARY_TOOLS: readonly AiToolDefinition[] = Object.entries(
  librarySchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name.startsWith("get_") ? "read" : "write",
  description: descriptions[name as keyof typeof descriptions],
}));
