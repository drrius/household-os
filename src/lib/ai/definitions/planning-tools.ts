import { z } from "zod";

import {
  assignmentFields,
  centimes,
  expenseSplitSchema,
  isoDate,
  mealSlot,
  uuid,
  webUrl,
  type AiToolDefinition,
} from "@/lib/ai/definitions/schemas";

export const GROCERY_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "add_grocery_item",
    kind: "write",
    description:
      "Add one item to the grocery list. Call once per item; check get_grocery_list first to avoid duplicates.",
    inputSchema: z.object({
      name: z.string().trim().min(1).max(120),
      quantity: z.string().max(30).nullish().describe('e.g. "2" or "500"'),
      unit: z.string().max(30).nullish().describe('e.g. "g", "pack"'),
      categoryId: uuid.nullish(),
      note: z.string().max(280).nullish(),
    }),
  },
  {
    name: "remove_grocery_item",
    kind: "write",
    description: "Remove an item from the grocery list without purchasing it.",
    inputSchema: z.object({ groceryItemId: uuid }),
  },
  {
    name: "start_shopping_session",
    kind: "write",
    description:
      "Start a shopping session for the signed-in member (one active session per member).",
    inputSchema: z.object({}),
  },
  {
    name: "claim_grocery_item",
    kind: "write",
    description:
      "Claim a grocery item into an active shopping session so the partner sees it is being bought.",
    inputSchema: z.object({ shoppingSessionId: uuid, groceryItemId: uuid }),
  },
  {
    name: "release_grocery_item",
    kind: "write",
    description: "Release a claimed grocery item back to the shared list.",
    inputSchema: z.object({ shoppingSessionId: uuid, groceryItemId: uuid }),
  },
  {
    name: "finish_shopping_session",
    kind: "write",
    description:
      "Finish a shopping session: claimed items become purchased. Optionally propose one expense draft for the shared amount — the draft still needs an explicit confirmation before it becomes a financial event.",
    inputSchema: z.object({
      shoppingSessionId: uuid,
      receiptTotalCents: centimes
        .nullish()
        .describe("Full receipt total, including personal items"),
      createExpenseDraft: z.boolean().optional().default(false),
      expenseDescription: z.string().max(200).nullish(),
      sharedAmountCents: centimes
        .nullish()
        .describe(
          "The shared part of the receipt; required with createExpenseDraft",
        ),
      payerMemberId: uuid
        .nullish()
        .describe("Required with createExpenseDraft"),
      split: expenseSplitSchema
        .nullish()
        .describe("How the draft splits the shared amount; defaults to equal"),
    }),
  },
];

export const MEAL_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "plan_meal",
    kind: "write",
    description:
      "Put a meal on the week plan. source library reuses a meal definition id from get_week_plan; freeform creates a new named meal; leftover links to an earlier entry.",
    inputSchema: z.object({
      date: isoDate,
      slot: mealSlot
        .nullish()
        .describe(
          "Omit for an unslotted note; it attaches to the whole week and the date snaps to that week's Monday",
        ),
      source: z.discriminatedUnion("kind", [
        z.object({ kind: z.literal("library"), mealDefinitionId: uuid }),
        z.object({
          kind: z.literal("freeform"),
          title: z.string().trim().min(1).max(120),
          recipeUrl: webUrl.nullish(),
          notes: z.string().max(500).nullish(),
        }),
        z.object({ kind: z.literal("leftover"), leftoverOfEntryId: uuid }),
      ]),
    }),
  },
  {
    name: "move_meal_entry",
    kind: "write",
    description: "Move a planned meal entry to another day or slot.",
    inputSchema: z.object({
      entryId: uuid,
      date: isoDate,
      slot: mealSlot.nullish(),
    }),
  },
  {
    name: "update_meal_entry",
    kind: "write",
    description:
      "Rename a planned meal entry or change its recipe URL/notes. Omitted slot/recipeUrl/notes keep their current values; null clears the URL or notes, and a null slot makes it an unslotted week note.",
    inputSchema: z.object({
      entryId: uuid,
      title: z.string().trim().min(1).max(120),
      date: isoDate,
      slot: mealSlot.nullish(),
      recipeUrl: webUrl.nullish(),
      notes: z.string().max(500).nullish(),
    }),
  },
  {
    name: "remove_meal_entry",
    kind: "write",
    description: "Remove a meal entry from the plan.",
    inputSchema: z.object({ entryId: uuid }),
  },
  {
    name: "create_meal_preparation",
    kind: "write",
    description:
      "Attach a one-off preparation task (e.g. defrost, marinate) to a planned meal entry. It shows up as a routine occurrence due on the given day.",
    inputSchema: z.object({
      mealPlanEntryId: uuid,
      title: z.string().trim().min(1).max(120),
      instructions: z.string().max(2000).nullish(),
      dueOn: isoDate,
      areaId: uuid,
      ...assignmentFields,
    }),
  },
];

export const HOUSEHOLD_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "create_area",
    kind: "write",
    description: "Create a household area (e.g. Kitchen, Bathroom).",
    inputSchema: z.object({ name: z.string().trim().min(1).max(80) }),
  },
  {
    name: "create_pet",
    kind: "write",
    description: "Add a pet to the household.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(80) }),
  },
  {
    name: "update_household_name",
    kind: "write",
    description: "Rename the household.",
    inputSchema: z.object({ name: z.string().trim().min(1).max(80) }),
  },
];
