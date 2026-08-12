import { loadTodayViewModel } from "@/lib/read-models/today";
import { TodayScreen } from "@/ui/today/today-screen";

export default async function TodayPage() {
  const view = await loadTodayViewModel();
  return <TodayScreen view={view} />;
}
