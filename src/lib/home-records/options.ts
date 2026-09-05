import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
export type RecordOption = { value: string; label: string };
export type RecordOptions = Record<string, RecordOption[]>;
const sources = {
  contact_id: ["household_contacts", "name", "id"],
  responsible_member_id: ["household_members", "display_name", "user_id"],
  recurring_expense_rule_id: ["recurring_expense_rules", "description", "id"],
  routine_id: ["routines", "title", "id"],
  project_id: ["household_projects", "title", "id"],
  asset_id: ["household_assets", "title", "id"],
  commitment_id: ["household_commitments", "title", "id"],
} as const;
export async function recordOptions(): Promise<RecordOptions> {
  const member = await requireMemberContext();
  const db = await createClient();
  return Object.fromEntries(
    await Promise.all(
      Object.entries(sources).map(async ([field, [table, label, id]]) => {
        const choices: RecordOption[] = [];
        for (let start = 0; ; start += 500) {
          const { data, error } = await db
            .from(table)
            .select(`${id},${label}`)
            .eq("household_id", member.householdId)
            .order(label)
            .order(id)
            .range(start, start + 499);
          if (error) throw new Error("Couldn't load record choices.");
          const rows = (data ?? []) as unknown as Record<string, string>[];
          choices.push(
            ...rows.map((row) => {
              const value = row[id],
                text = row[label];
              if (!value || !text) throw new Error("Invalid record choice.");
              return { value, label: text };
            }),
          );
          if (rows.length < 500) return [field, choices] as const;
        }
      }),
    ),
  );
}
