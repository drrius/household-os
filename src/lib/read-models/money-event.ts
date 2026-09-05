import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { refundAvailability } from "@/domain/money/refund-remaining";
import { isHouseholdAttachment } from "@/domain/attachments/files";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const cents = z.number().int().refine(Number.isSafeInteger);
const eventSchema = z.object({
  id: z.string().uuid(),
  type: z.enum([
    "expense",
    "refund",
    "settlement",
    "opening_balance",
    "reversal",
    "replacement",
  ]),
  description: z.string(),
  amount_cents: cents,
  occurred_on: z.string(),
  created_at: z.string(),
  payer_member_id: z.string().uuid().nullable(),
  created_by_member_id: z.string().uuid(),
  related_event_id: z.string().uuid().nullable(),
  category_id: z.string().uuid().nullable(),
  note: z.string().nullable(),
  receipt_path: z.string().nullable(),
  shopping_session_id: z.string().uuid().nullable(),
});
const allocationSchema = z.object({
  financial_event_id: z.string().uuid(),
  member_id: z.string().uuid(),
  allocated_cents: cents,
});
const membersSchema = z.array(
  z.object({ user_id: z.string().uuid(), display_name: z.string() }),
);
const ledgerSchema = z.array(
  z.object({ member_id: z.string().uuid(), receivable_delta_cents: cents }),
);
const eventColumns =
  "id, type, description, amount_cents, occurred_on, created_at, payer_member_id, created_by_member_id, related_event_id, category_id, note, receipt_path, shopping_session_id";

async function refundState(
  client: SupabaseClient,
  householdId: string,
  shares: z.infer<typeof allocationSchema>[],
  children: z.infer<typeof eventSchema>[],
) {
  const refunds = children.filter((child) => child.type === "refund");
  const refundIds = refunds.map((refund) => refund.id);
  const [refundShares, reversals] = refundIds.length
    ? await Promise.all([
        client
          .from("financial_allocations")
          .select("financial_event_id, member_id, allocated_cents")
          .eq("household_id", householdId)
          .in("financial_event_id", refundIds),
        client
          .from("financial_events")
          .select("related_event_id")
          .eq("household_id", householdId)
          .eq("type", "reversal")
          .in("related_event_id", refundIds),
      ])
    : [
        { data: [], error: null },
        { data: [], error: null },
      ];
  if (refundShares.error || reversals.error)
    throw new Error("Could not calculate the refundable amount.");
  const reversedRefunds = new Set(
    (reversals.data ?? []).map((row) => row.related_event_id),
  );
  const availability = refundAvailability(
    shares.map((row) => ({
      memberId: row.member_id,
      allocatedCents: row.allocated_cents,
    })),
    z
      .array(allocationSchema)
      .parse(refundShares.data)
      .filter((row) => !reversedRefunds.has(row.financial_event_id))
      .map((row) => ({
        memberId: row.member_id,
        allocatedCents: row.allocated_cents,
      })),
  );
  return {
    ...availability,
    activeRefundCount: refunds.filter(
      (refund) => !reversedRefunds.has(refund.id),
    ).length,
  };
}

export async function loadMoneyEvent(id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const member = await requireMemberContext();
  const client = await createClient();
  const eventResult = await client
    .from("financial_events")
    .select(eventColumns)
    .eq("household_id", member.householdId)
    .eq("id", id)
    .maybeSingle();
  if (eventResult.error)
    throw new Error("Could not load this financial event.");
  if (!eventResult.data) return null;
  const event = eventSchema.parse(eventResult.data);
  const [people, allocations, ledger, related, parent] = await Promise.all([
    client
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId),
    client
      .from("financial_allocations")
      .select("financial_event_id, member_id, allocated_cents")
      .eq("household_id", member.householdId)
      .eq("financial_event_id", id)
      .order("member_id"),
    client
      .from("ledger_entries")
      .select("member_id, receivable_delta_cents")
      .eq("household_id", member.householdId)
      .eq("financial_event_id", id),
    client
      .from("financial_events")
      .select(eventColumns)
      .eq("household_id", member.householdId)
      .eq("related_event_id", id)
      .order("created_at"),
    event.related_event_id
      ? client
          .from("financial_events")
          .select("id, description, type")
          .eq("household_id", member.householdId)
          .eq("id", event.related_event_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (
    [people, allocations, ledger, related, parent].some(
      (result) => result.error,
    )
  )
    throw new Error("Could not load the event explanation.");
  const shares = z.array(allocationSchema).parse(allocations.data);
  const children = z.array(eventSchema).parse(related.data);
  const refund = await refundState(
    client,
    member.householdId,
    shares,
    children,
  );
  return {
    event,
    allocations: shares,
    ledger: ledgerSchema.parse(ledger.data),
    members: membersSchema.parse(people.data),
    related: children,
    parent: parent.data,
    ...refund,
    canCorrectOpening:
      event.type === "opening_balance" &&
      !children.some((child) => child.type === "opening_balance"),
    isReversed: children.some((child) => child.type === "reversal"),
    viewerId: member.userId,
    receiptPath:
      event.receipt_path &&
      isHouseholdAttachment(event.receipt_path, member.householdId)
        ? event.receipt_path
        : null,
  };
}

export type MoneyEventDetail = NonNullable<
  Awaited<ReturnType<typeof loadMoneyEvent>>
>;
