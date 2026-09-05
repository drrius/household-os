import { loadPlanViewModel } from "@/lib/read-models/plan";
import { PlanScreen } from "@/ui/plan/plan-screen";

type PlanPageProps = {
  searchParams: Promise<{ week?: string | string[]; day?: string }>;
};

export default async function PlanPage({ searchParams }: PlanPageProps) {
  const { week, day } = await searchParams;
  const plan = await loadPlanViewModel(typeof week === "string" ? week : null);

  return <PlanScreen plan={plan} selectedDay={day} />;
}
