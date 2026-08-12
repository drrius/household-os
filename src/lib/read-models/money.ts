import { z } from "zod";

import type { FrancDisplay } from "@/lib/ui/franc-display";

const eventTypeSchema = z.enum([
  "opening_balance",
  "expense",
  "refund",
  "settlement",
  "reversal",
  "replacement",
]);
const sourceKindSchema = z.enum(["shopping", "recurring"]);
const safeIntegerSchema = z
  .number()
  .int()
  .refine(Number.isSafeInteger, "Expected safe integer centimes");
const amountSchema = safeIntegerSchema.nonnegative();
const memberRowSchema = z.object({
  user_id: z.string().min(1),
  display_name: z.string().min(1),
});
const ledgerRowSchema = z.object({
  financial_event_id: z.string().min(1),
  member_id: z.string().min(1),
  receivable_delta_cents: safeIntegerSchema,
});
const eventRowSchema = z.object({
  id: z.string().min(1),
  type: eventTypeSchema,
  occurred_on: z.string().min(1),
  created_at: z.string().min(1),
  created_by_member_id: z.string().min(1),
  payer_member_id: z.string().min(1).nullable(),
  description: z.string().min(1),
  amount_cents: amountSchema,
  related_event_id: z.string().min(1).nullable(),
});
const allocationRowSchema = z.object({
  financial_event_id: z.string().min(1),
  member_id: z.string().min(1),
  allocated_cents: amountSchema,
});
const draftRowSchema = z.object({
  id: z.string().min(1),
  source_kind: sourceKindSchema,
  description: z.string().min(1),
  amount_cents: amountSchema.nullable(),
  occurred_on: z.string().min(1),
  payer_member_id: z.string().min(1).nullable(),
  proposed_allocations: z.unknown(),
});

type MoneyMemberRow = z.infer<typeof memberRowSchema>;
type MoneyLedgerRow = z.infer<typeof ledgerRowSchema>;
type MoneyEventRow = z.infer<typeof eventRowSchema>;
type MoneyAllocationRow = z.infer<typeof allocationRowSchema>;
type MoneyDraftRow = z.infer<typeof draftRowSchema>;

export type BalanceHero =
  | { kind: "settled" }
  | {
      kind: "partner_owes_you";
      partnerName: string;
      amount: FrancDisplay;
    }
  | {
      kind: "you_owe_partner";
      partnerName: string;
      amount: FrancDisplay;
    };

export type MoneyViewModel = {
  hasOpeningBalance: boolean;
  hero: BalanceHero;
  explanation: Array<{ label: string; delta: FrancDisplay }>;
  drafts: Array<{
    id: string;
    title: string;
    amount: FrancDisplay | null;
    meta: string;
    source: string;
    canConfirm: boolean;
  }>;
  events: Array<{
    id: string;
    title: string;
    meta: string;
    amount: FrancDisplay;
    type: string;
  }>;
};

export type MoneyReadInput = {
  viewerId: string;
  members: readonly MoneyMemberRow[];
  ledgerEntries: readonly MoneyLedgerRow[];
  events: readonly MoneyEventRow[];
  allocations: readonly MoneyAllocationRow[];
  drafts: readonly MoneyDraftRow[];
};
export type MoneyReadRows = Omit<MoneyReadInput, "viewerId">;

export { mapMoneyViewModel } from "@/lib/read-models/money-map";

export function parseMoneyReadRows(
  input: Record<keyof MoneyReadRows, unknown>,
): MoneyReadRows {
  return {
    members: z.array(memberRowSchema).parse(input.members),
    ledgerEntries: z.array(ledgerRowSchema).parse(input.ledgerEntries),
    events: z.array(eventRowSchema).parse(input.events),
    allocations: z.array(allocationRowSchema).parse(input.allocations),
    drafts: z.array(draftRowSchema).parse(input.drafts),
  };
}
