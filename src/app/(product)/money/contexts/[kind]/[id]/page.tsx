import { notFound } from "next/navigation";
import { loadHouseholdMembers } from "@/app/(product)/_actions/m7-shared";
import { loadCostContext } from "@/lib/connected/cost-context";
import { loadCostRecord } from "@/lib/connected/cost-records";
import { parseCostRoute } from "@/lib/connected/cost-route";
import { ContextCosts } from "@/ui/money/context-costs";
export default async function CostPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const args = await Promise.all([params, searchParams]);
  let route;
  try {
    route = parseCostRoute(...args);
  } catch {
    notFound();
  }
  const record = await loadCostRecord(route.target);
  if (!record) notFound();
  const [costs, members] = await Promise.all([
    loadCostContext(route.target.kind, route.target.id, {
      before: route.before,
      bookingId: route.target.bookingId,
    }),
    loadHouseholdMembers(),
  ]);
  return (
    <ContextCosts
      {...record}
      target={route.target}
      costs={costs}
      members={members}
      older={Boolean(route.before)}
      saved={route.saved}
      associationSaved={route.associationSaved}
    />
  );
}
