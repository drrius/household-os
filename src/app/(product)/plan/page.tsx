import { loadPlanViewModel } from "@/lib/read-models/plan";
import { PlanScreen } from "@/ui/plan/plan-screen";

type PlanPageProps = {
  searchParams: Promise<{ week?: string | string[] }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { week } = await searchParams;
  const plan = await loadPlanViewModel(typeof week === "string" ? week : null);

  return <PlanScreen plan={plan} />;
}
