import { loadTodayAgenda } from "@/lib/read-models/today-agenda";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { loadTodayViewModel } from "@/lib/read-models/today";
import { TodayScreen } from "@/ui/today/today-screen";

export default async function TodayPage() {
  const today = zurichCivilDate();
  const [view, agenda] = await Promise.all([
    loadTodayViewModel(today),
    loadTodayAgenda(today),
  ]);
  return <TodayScreen view={view} agenda={agenda} />;
}
