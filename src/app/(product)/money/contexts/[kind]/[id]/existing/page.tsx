import { notFound } from "next/navigation";
import { loadAssociationExpenses } from "@/lib/connected/cost-associations";
import { loadCostRecord } from "@/lib/connected/cost-records";
import { parseCostRoute } from "@/lib/connected/cost-route";
import { AssociationExpenses } from "@/ui/money/association-expenses";
export default async function Page({
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
  if (!record || record.record.archived_at || record.booking?.archived_at)
    notFound();
  const page = await loadAssociationExpenses(
    route.before
      ? { beforeOn: route.before.occurred_on, beforeId: route.before.id }
      : undefined,
  );
  return (
    <AssociationExpenses
      {...page}
      target={route.target}
      title={record.booking?.title ?? record.record.title}
      older={Boolean(route.before)}
    />
  );
}
