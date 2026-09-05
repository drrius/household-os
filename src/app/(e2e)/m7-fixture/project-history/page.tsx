import { notFound } from "next/navigation";
import { AppShell } from "@/ui/shell/app-shell";
import { ProjectHistory } from "@/ui/projects/project-history";

export default async function HistoryFixture({
  searchParams,
}: {
  searchParams: Promise<{ historyPage?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const page = (await searchParams).historyPage === "1" ? 1 : 0;
  return (
    <AppShell>
      <ProjectHistory
        page={page}
        hasMore={page === 0}
        href={(value) =>
          `/m7-fixture/project-history?historyPage=${value}#history`
        }
        members={[
          { user_id: "a", display_name: "Alex" },
          { user_id: "b", display_name: "Sam" },
        ]}
        entries={[
          {
            id: String(page),
            actor_member_id: "a",
            created_at: "2026-09-05T09:00:00Z",
            payload: {
              title: page === 0 ? "Book the hotel" : "Summer trip",
              operation: "updated",
              before: {
                notes: "Call on Tuesday",
                assigned_member_id: "a",
                budget_cents: 501,
              },
              after: { notes: "", assigned_member_id: "b", budget_cents: 800 },
              changed_fields: ["notes", "assigned_member_id", "budget_cents"],
            },
          },
        ]}
      />
    </AppShell>
  );
}
