import Link from "next/link";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";

export async function RoutineHistory({ routineId }: { routineId: string }) {
  const member = await requireMemberContext();
  const client = await createClient();
  const { data, error } = await client
    .from("routine_occurrences")
    .select("id, due_date, status")
    .eq("household_id", member.householdId)
    .eq("routine_id", routineId)
    .in("status", ["completed", "skipped"])
    .order("closed_at", { ascending: false })
    .limit(10);
  if (error) throw new Error("Couldn't load the routine history.");
  if (!data?.length) return null;
  return (
    <section
      className="grid gap-3 border-t pt-6"
      aria-labelledby="routine-history-title"
    >
      <h2
        className="font-heading text-lg font-semibold"
        id="routine-history-title"
      >
        Recent history
      </h2>
      <ul className="divide-y divide-border" role="list">
        {data.map((row) => (
          <li key={row.id}>
            <Link
              className="flex min-h-11 items-center justify-between gap-3 py-2 no-underline"
              href={`/home/occurrences/${row.id}`}
            >
              <p>{formatZurichDayLabel(row.due_date)}</p>
              <p className="text-base text-muted-foreground sm:text-sm">
                {row.status === "completed" ? "Completed" : "Skipped"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/home/routines/${routineId}/history`}>View all history</Link>
    </section>
  );
}
