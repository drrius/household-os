import "server-only";
import { z } from "zod";
import {
  costKind,
  costTargetSchema,
  type CostTarget,
  type CostRecord,
} from "@/domain/money/cost-target";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const tables = {
  project: "household_projects",
  asset: "household_assets",
  commitment: "household_commitments",
} as const;
const recordSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  archived_at: z.string().nullable(),
});
export async function loadCostRecords(
  kind: CostTarget["kind"],
  archived: boolean,
  page: number,
) {
  const table = tables[costKind.parse(kind)];
  const offset = z.number().int().min(0).max(10000).parse(page) * 30;
  const member = await requireMemberContext();
  const db = await createClient();
  let query = db
    .from(table)
    .select("id,title,archived_at")
    .eq("household_id", member.householdId);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data, error } = await query
    .order("title")
    .order("id")
    .range(offset, offset + 30);
  if (error) throw new Error("Could not load these records. Try again.");
  const records = z.array(recordSchema).parse(data);
  return { records: records.slice(0, 30), hasMore: records.length > 30 };
}
export async function loadCostRecord(
  input: CostTarget,
): Promise<{ record: CostRecord; booking: CostRecord | null } | null> {
  const target = costTargetSchema.parse(input);
  const member = await requireMemberContext();
  const db = await createClient();
  const { data, error } = await db
    .from(tables[target.kind])
    .select("id,title,archived_at")
    .eq("household_id", member.householdId)
    .eq("id", target.id)
    .maybeSingle();
  if (error) throw new Error("Could not load this record. Try again.");
  if (!data) return null;
  let booking: CostRecord | null = null;
  if (target.bookingId) {
    const result = await db
      .from("trip_bookings")
      .select("id,title,archived_at")
      .eq("household_id", member.householdId)
      .eq("project_id", target.id)
      .eq("id", target.bookingId)
      .maybeSingle();
    if (result.error)
      throw new Error("Could not load this booking. Try again.");
    if (!result.data) return null;
    booking = recordSchema.parse(result.data);
  }
  return { record: recordSchema.parse(data), booking };
}
