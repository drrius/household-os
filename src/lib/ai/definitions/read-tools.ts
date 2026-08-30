import { z } from "zod";

import { isoDate, type AiToolDefinition } from "@/lib/ai/definitions/schemas";

export const READ_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "get_today_overview",
    kind: "read",
    description:
      "Today's household work: open routine occurrences that are due or overdue (with occurrence ids), meal preparation tasks, and pending expense drafts. Call this first when the request concerns today.",
    inputSchema: z.object({}),
  },
  {
    name: "get_routines",
    kind: "read",
    description:
      "All routines with their schedule, assignment, paused state, and the current open occurrence id and due date. Use this to find a routine id or occurrence id by name.",
    inputSchema: z.object({
      includeArchived: z.boolean().optional().default(false),
    }),
  },
  {
    name: "get_week_plan",
    kind: "read",
    description:
      "The meal plan for one Monday-to-Sunday week: entries per day and slot with entry ids, plus the meal library for reuse (alphabetical; mealLibraryTruncated flags an incomplete list — narrow it with librarySearch).",
    inputSchema: z.object({
      weekOf: isoDate
        .optional()
        .describe("Any date in the wanted week; defaults to the current week"),
      librarySearch: z
        .string()
        .trim()
        .min(1)
        .max(120)
        .optional()
        .describe("Case-insensitive name filter for the meal library"),
    }),
  },
  {
    name: "get_grocery_list",
    kind: "read",
    description:
      "The current grocery list (active and claimed items with ids, quantities, and categories) and any active shopping session.",
    inputSchema: z.object({}),
  },
  {
    name: "get_money_overview",
    kind: "read",
    description:
      "Who owes whom and how much, pending expense drafts, recurring expense rules, and recent financial events with ids and their allocations. Amounts are CHF centimes. recentEventsTruncated flags older history; page back with eventsBefore.",
    inputSchema: z.object({
      eventsBefore: isoDate
        .optional()
        .describe("Only events strictly before this date; for older history"),
    }),
  },
  {
    name: "get_household",
    kind: "read",
    description:
      "Household name, the two members (with member ids), areas, pets, and grocery/expense categories. Call this whenever you need a member id, area id, pet id, or category id.",
    inputSchema: z.object({}),
  },
];
