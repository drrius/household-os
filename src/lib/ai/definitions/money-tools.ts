import { z } from "zod";

import {
  allocationCentimes,
  centimes,
  expenseSplitSchema,
  isoDate,
  isoWeekday,
  uuid,
  withSplitAmountCheck,
  type AiToolDefinition,
} from "@/lib/ai/definitions/schemas";

/** Money tools that only touch drafts and rules, never financial history. */
export const MONEY_DRAFT_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "dismiss_expense_draft",
    kind: "write",
    description:
      "Dismiss a pending expense draft so it never becomes a financial event.",
    inputSchema: z.object({ draftId: uuid }),
  },
  {
    name: "create_recurring_expense_rule",
    kind: "write",
    description:
      "Create a recurring expense rule (e.g. rent, subscriptions). Rules only generate drafts that must be confirmed; they never post directly.",
    inputSchema: withSplitAmountCheck(
      z.object({
        description: z.string().trim().min(1).max(200),
        amountCents: centimes,
        payerMemberId: uuid,
        split: expenseSplitSchema,
        schedule: z.discriminatedUnion("kind", [
          z.object({ kind: z.literal("weekly"), isoWeekday }),
          z.object({
            kind: z.literal("monthly"),
            dayOfMonth: z.number().int().min(1).max(31),
          }),
        ]),
        nextOccurrenceOn: isoDate,
        categoryId: uuid.nullish(),
      }),
    ),
  },
  {
    name: "set_recurring_expense_rule_active",
    kind: "write",
    description: "Activate or deactivate a recurring expense rule.",
    inputSchema: z.object({ ruleId: uuid, active: z.boolean() }),
  },
];

/** Tools that append to the financial history; they always need approval. */
export const FINANCIAL_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "record_expense",
    kind: "financial",
    description:
      "Record a shared expense in the financial history. Requires the member's explicit approval before it executes. Amounts are CHF centimes.",
    inputSchema: withSplitAmountCheck(
      z.object({
        description: z.string().trim().min(1).max(200),
        amountCents: centimes,
        payerMemberId: uuid,
        split: expenseSplitSchema,
        occurredOn: isoDate.optional().describe("Defaults to today"),
        categoryId: uuid.nullish(),
        note: z.string().max(500).nullish(),
      }),
    ),
  },
  {
    name: "record_refund",
    kind: "financial",
    description:
      "Record a refund against an existing expense event, with custom allocations mirroring the original shares. Requires the member's explicit approval before it executes.",
    inputSchema: withSplitAmountCheck(
      z.object({
        relatedEventId: uuid,
        payerMemberId: uuid.describe(
          "The original event's payer (from get_money_overview); shown on the approval card and checked against the event",
        ),
        description: z.string().trim().min(1).max(200),
        amountCents: centimes,
        // Custom-only on purpose: an "equal" refund would be rejected at
        // execution time, after the member already approved it.
        split: z
          .object({
            kind: z.literal("custom"),
            allocations: z
              .array(
                z.object({
                  memberId: uuid,
                  allocatedCents: allocationCentimes,
                }),
              )
              .length(2),
          })
          .describe(
            "Custom allocations mirroring the original expense shares; both members, summing to amountCents",
          ),
        occurredOn: isoDate.optional().describe("Defaults to today"),
        note: z.string().max(500).nullish(),
      }),
    ),
  },
  {
    name: "record_settlement",
    kind: "financial",
    description:
      "Record that the member who owes money paid the other back. payerMemberId is the debtor making the payment. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      payerMemberId: uuid,
      amountCents: centimes,
      mode: z
        .enum(["full", "partial"])
        .describe("full settles the whole outstanding balance"),
      description: z.string().trim().min(1).max(200),
      occurredOn: isoDate.optional().describe("Defaults to today"),
      note: z.string().max(500).nullish(),
    }),
  },
  {
    name: "establish_opening_balance",
    kind: "financial",
    description:
      "Record the one-time opening balance the household starts from. creditorMemberId is who is owed. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      creditorMemberId: uuid,
      amountCents: centimes,
      description: z.string().trim().min(1).max(200),
      occurredOn: isoDate.optional().describe("Defaults to today"),
      note: z.string().max(500).nullish(),
    }),
  },
  {
    name: "confirm_expense_draft",
    kind: "financial",
    description:
      "Confirm a pending expense draft, turning it into a real financial event. Echo the draft's amountCents and payerMemberId from get_money_overview (they are shown on the approval card), or pass different values to override; changing the amount also requires a split. Requires the member's explicit approval before it executes.",
    inputSchema: withSplitAmountCheck(
      z.object({
        draftId: uuid,
        description: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .describe(
            "The stored draft's description (from get_money_overview); shown on the approval card and checked against the draft",
          ),
        amountCents: centimes.describe(
          "The draft's amount, or a corrected amount (then split is required)",
        ),
        payerMemberId: uuid.describe("The draft's payer, or an override"),
        split: expenseSplitSchema.nullish(),
        occurredOn: isoDate.nullish(),
        categoryId: uuid.nullish(),
        note: z.string().max(500).nullish(),
      }),
    ),
  },
  {
    name: "correct_financial_event",
    kind: "financial",
    description:
      "Correct a financial event by reversal (and optional replacement). History stays append-only: the original is never edited. Echo the event's current description and amount from get_money_overview; they are shown on the approval card and checked. Omitted categoryId/note keep the original's values (null clears them) and the receipt carries over. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      eventId: uuid,
      originalDescription: z
        .string()
        .trim()
        .min(1)
        .max(200)
        .describe(
          "The corrected event's current description (from get_money_overview); shown on the approval card and checked against the event",
        ),
      originalAmountCents: centimes.describe(
        "The corrected event's current amount; shown and checked likewise",
      ),
      replacement: withSplitAmountCheck(
        z.object({
          description: z.string().trim().min(1).max(200),
          amountCents: centimes,
          payerMemberId: uuid,
          split: expenseSplitSchema,
          occurredOn: isoDate,
          categoryId: uuid.nullish(),
          note: z.string().max(500).nullish(),
        }),
      )
        .nullish()
        .describe("Omit to reverse the event without a replacement"),
    }),
  },
];
