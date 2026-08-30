import { loadPlanViewModel } from "@/lib/read-models/plan";
import { PlanScreen } from "@/ui/plan/plan-screen";

type PlanPageProps = {
  searchParams: Promise<{ date?: string | string[] }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { date } = await searchParams;
  const plan = await loadPlanViewModel(typeof date === "string" ? date : null);

  return <PlanScreen plan={plan} />;
}
