import "server-only";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

type RecordTable =
  | "household_projects"
  | "project_tasks"
  | "trip_bookings"
  | "household_contacts"
  | "household_assets"
  | "household_commitments"
  | "household_decisions"
  | "decision_options"
  | "household_financial_links"
  | "household_documents"
  | "asset_maintenance"
  | "asset_routines";

type RecordFields = Readonly<Record<string, string | number | boolean | null>>;

export async function saveHouseholdRecord(
  table: RecordTable,
  id: string,
  fields: RecordFields,
  expectedUpdatedAt: string | null,
): Promise<void> {
  const member = await requireMemberContext();
  const client = await createClient();
  if (expectedUpdatedAt !== null) {
    const { data, error } = await client
      .from(table)
      .update(fields)
      .eq("household_id", member.householdId)
      .eq("id", id)
      .eq("updated_at", expectedUpdatedAt)
      .select("id")
      .maybeSingle();
    if (error)
      throw new Error("Couldn't save. Check the details and try again.");
    if (!data)
      throw new Error(
        "This changed since you opened it. Reload to see the latest version before saving.",
      );
    return;
  }
  const { error } = await client.from(table).insert({
    ...fields,
    id,
    household_id: member.householdId,
    created_by: member.userId,
  });
  if (!error) return;
  if (error.code === "23505") {
    const prior = await client
      .from(table)
      .select("*")
      .eq("id", id)
      .eq("household_id", member.householdId)
      .maybeSingle();
    if (
      !prior.error &&
      prior.data &&
      Object.entries(fields).every(([key, value]) => prior.data[key] === value)
    )
      return;
  }
  throw new Error("Couldn't create this. Check the details and try again.");
}

export async function archiveHouseholdRecord(
  table: RecordTable,
  id: string,
  updatedAt: string,
  archived: boolean,
) {
  await saveHouseholdRecord(
    table,
    id,
    { archived_at: archived ? new Date().toISOString() : null },
    updatedAt,
  );
}
