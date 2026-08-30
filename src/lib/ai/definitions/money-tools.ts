import { z } from "zod";

import {
  centimes,
  expenseSplitSchema,
  isoDate,
  isoWeekday,
  uuid,
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
    inputSchema: z.object({
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
    inputSchema: z.object({
      description: z.string().trim().min(1).max(200),
      amountCents: centimes,
      payerMemberId: uuid,
      split: expenseSplitSchema,
      occurredOn: isoDate.optional().describe("Defaults to today"),
      categoryId: uuid.nullish(),
      note: z.string().max(500).nullish(),
    }),
  },
  {
    name: "record_refund",
    kind: "financial",
    description:
      "Record a refund against an existing expense event, with custom allocations mirroring the original shares. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      relatedEventId: uuid,
      description: z.string().trim().min(1).max(200),
      amountCents: centimes,
      // Custom-only on purpose: an "equal" refund would be rejected at
      // execution time, after the member already approved it.
      split: z
        .object({
          kind: z.literal("custom"),
          allocations: z
            .array(z.object({ memberId: uuid, allocatedCents: centimes }))
            .length(2),
        })
        .describe(
          "Custom allocations mirroring the original expense shares; both members, summing to amountCents",
        ),
      occurredOn: isoDate.optional().describe("Defaults to today"),
      note: z.string().max(500).nullish(),
    }),
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
      "Confirm a pending expense draft, turning it into a real financial event. Optional fields override the draft's proposal. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      draftId: uuid,
      amountCents: centimes.nullish(),
      payerMemberId: uuid.nullish(),
      split: expenseSplitSchema.nullish(),
      occurredOn: isoDate.nullish(),
      categoryId: uuid.nullish(),
      note: z.string().max(500).nullish(),
    }),
  },
  {
    name: "correct_financial_event",
    kind: "financial",
    description:
      "Correct a financial event by reversal (and optional replacement). History stays append-only: the original is never edited. Requires the member's explicit approval before it executes.",
    inputSchema: z.object({
      eventId: uuid,
      replacement: z
        .object({
          description: z.string().trim().min(1).max(200),
          amountCents: centimes,
          payerMemberId: uuid,
          split: expenseSplitSchema,
          occurredOn: isoDate,
          categoryId: uuid.nullish(),
          note: z.string().max(500).nullish(),
        })
        .nullish()
        .describe("Omit to reverse the event without a replacement"),
    }),
  },
];
