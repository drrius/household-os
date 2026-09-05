import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { costTargetSchema, type CostTarget } from "@/domain/money/cost-target";
import { loadCostRecord } from "./cost-records";

const eventSchema = z.object({
  id: z.uuid(),
  description: z.string(),
  occurred_on: z.iso.date(),
  payer_member_id: z.uuid(),
  amount_cents: z.number().int().nonnegative().safe(),
  type: z.enum(["expense", "replacement"]),
});
const linkSchema = z.object({
  id: z.uuid(),
  financial_event_id: z.uuid(),
  revision: z.uuid(),
  project_id: z.uuid().nullable(),
  asset_id: z.uuid().nullable(),
  commitment_id: z.uuid().nullable(),
  booking_id: z.uuid().nullable(),
  archived_at: z.string().nullable(),
});
export type AssociationExpense = z.infer<typeof eventSchema>;
export type ExpenseAssociation = z.infer<typeof linkSchema>;
const eventColumns =
  "id,description,occurred_on,amount_cents,type,payer_member_id";
const linkColumns =
  "id,financial_event_id,revision,project_id,asset_id,commitment_id,booking_id,archived_at";
export const expenseCursor = z.object({
  beforeOn: z.iso.date(),
  beforeId: z.uuid(),
});
export async function loadAssociationExpenses(
  before?: z.infer<typeof expenseCursor>,
) {
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  let query = db
    .from("financial_events")
    .select(eventColumns)
    .eq("household_id", householdId)
    .in("type", ["expense", "replacement"]);
  if (before) {
    const cursor = expenseCursor.parse(before);
    query = query.or(
      `occurred_on.lt.${cursor.beforeOn},and(occurred_on.eq.${cursor.beforeOn},id.lt.${cursor.beforeId})`,
    );
  }
  const { data, error } = await query
    .order("occurred_on", { ascending: false })
    .order("id", { ascending: false })
    .limit(31);
  if (error) throw new Error("Could not load recorded expenses. Try again.");
  const all = z.array(eventSchema).parse(data);
  return { expenses: all.slice(0, 30), hasMore: all.length > 30 };
}
export async function loadAssociationExpense(inputId: string) {
  const id = z.uuid().parse(inputId);
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const [event, link] = await Promise.all([
    db
      .from("financial_events")
      .select(eventColumns)
      .eq("household_id", householdId)
      .eq("id", id)
      .in("type", ["expense", "replacement"])
      .maybeSingle(),
    db
      .from("household_financial_links")
      .select(linkColumns)
      .eq("household_id", householdId)
      .eq("financial_event_id", id)
      .maybeSingle(),
  ]);
  if (event.error || link.error)
    throw new Error("Could not load this expense association. Try again.");
  if (!event.data) return null;
  const association = link.data ? linkSchema.parse(link.data) : null;
  const target =
    association?.archived_at === null ? associationTarget(association) : null;
  const current = target ? await loadCostRecord(target) : null;
  return {
    expense: eventSchema.parse(event.data),
    association,
    current,
    currentTarget: target,
  };
}
export function associationTarget(link: ExpenseAssociation): CostTarget {
  return costTargetSchema.parse({
    kind: link.project_id ? "project" : link.asset_id ? "asset" : "commitment",
    id: link.project_id ?? link.asset_id ?? link.commitment_id,
    bookingId: link.booking_id ?? undefined,
  });
}
export async function loadAssociationById(inputId: string) {
  const id = z.uuid().parse(inputId);
  const { householdId } = await requireMemberContext();
  const db = await createClient();
  const { data, error } = await db
    .from("household_financial_links")
    .select(linkColumns)
    .eq("household_id", householdId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error("Could not load this association. Try again.");
  if (!data) return null;
  return loadAssociationExpense(linkSchema.parse(data).financial_event_id);
}
export async function assignExpenseContext(input: {
  eventId: string;
  expectedRevision: string | null;
  requestId: string;
  target: CostTarget | null;
}) {
  const { householdId } = await requireMemberContext();
  const eventId = z.uuid().parse(input.eventId);
  const expected = z.uuid().nullable().parse(input.expectedRevision);
  const requestId = z.uuid().parse(input.requestId);
  const target = input.target ? costTargetSchema.parse(input.target) : null;
  const db = await createClient();
  const { data, error } = await db.rpc("assign_expense_context", {
    p_household_id: householdId,
    p_event_id: eventId,
    p_expected_revision: expected,
    p_request_id: requestId,
    p_context_kind: target?.kind ?? null,
    p_context_id: target?.id ?? null,
    p_booking_id: target?.bookingId ?? null,
  });
  if (error) {
    if (["40001", "23505"].includes(error.code))
      throw new Error(
        "This expense association changed. Reopen it to review the latest choice.",
      );
    if (["22023", "42501"].includes(error.code))
      throw new Error(
        "This association is unavailable or its details changed. Reopen it and check the record is active.",
      );
    throw new Error(
      "Couldn't confirm the association. Retry with the same details.",
    );
  }
  z.object({ event_id: z.uuid() }).parse(data);
}
