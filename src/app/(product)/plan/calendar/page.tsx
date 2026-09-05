import { loadAgenda } from "@/lib/calendar/agenda";
import { AgendaScreen } from "@/ui/calendar/agenda-screen";
export const maxDuration = 60;
export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  return <AgendaScreen model={await loadAgenda(week)} />;
}
