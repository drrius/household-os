import "server-only";
import { z } from "zod";
import type { InboxRow } from "@/domain/notifications/inbox-presentation";
import type { createClient } from "@/lib/supabase/server";
export async function availableInboxTargets(
  rows: readonly InboxRow[],
  householdId: string,
  db: Awaited<ReturnType<typeof createClient>>,
) {
  const configs = [
    { kind: "routine", table: "routines", column: "archived_at" },
    {
      kind: "meal_plan_entry",
      table: "meal_plan_entries",
      column: "removed_at",
    },
    { kind: "expense_draft", table: "expense_drafts", column: "status" },
  ];
  const matches = await Promise.all(
    configs.map(async (config) => {
      const ids = [
        ...new Set(
          rows
            .filter(
              (row) =>
                row.entity_type === config.kind &&
                z.uuid().safeParse(row.entity_id).success,
            )
            .map((row) => row.entity_id!),
        ),
      ];
      if (!ids.length) return [];
      let query = db
        .from(config.table)
        .select("id")
        .eq("household_id", householdId)
        .in("id", ids);
      query =
        config.kind === "expense_draft"
          ? query.eq("status", "pending")
          : query.is(config.column, null);
      const { data, error } = await query;
      // A section link remains useful if an optional destination cannot be resolved.
      if (error) return [];
      return (data ?? []).map((row) => `${config.kind}:${row.id}`);
    }),
  );
  return new Set(matches.flat());
}
