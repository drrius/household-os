import { notFound } from "next/navigation";
import { AppShell } from "@/ui/shell/app-shell";
import { PlanResourcesView } from "@/ui/projects/plan-resources-view";
export default async function ResourcesFixture({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { archived } = await searchParams;
  const projectId = "f0000000-0000-4000-8000-000000000001";
  const bookingId = "f0000000-0000-4000-8000-000000000011";
  return (
    <AppShell>
      <h1 className="mb-5 font-heading text-3xl">Weekend hotel</h1>
      <PlanResourcesView
        target={{ kind: "project", id: projectId, bookingId }}
        paidCents="7500"
        archived={archived === "1"}
        returnTo={`/plan/projects/${projectId}/bookings/${bookingId}?documentPage=0&back=${encodeURIComponent(`/plan/projects/${projectId}?taskPage=2`)}`}
        documents={{
          rows: [
            {
              id: "f0000000-0000-4000-8000-000000000013",
              title: "Hotel confirmation",
            },
          ],
          count: 21,
          page: 0,
        }}
        showArchived={false}
      />
    </AppShell>
  );
}
