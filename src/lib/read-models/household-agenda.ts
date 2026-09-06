import "server-only";
import { loadCalendarOccurrences } from "@/lib/calendar/agenda";
import { addCivilDays, zurichCivilDate } from "@/lib/ui/zurich-date";
import { buildHouseholdAgenda } from "@/domain/today/agenda";
import { loadPlanningSources } from "./planning-sources";

export async function loadHouseholdAgenda(today = zurichCivilDate()) {
  const horizon = addCivilDays(today, 6);
  const [sources, calendar] = await Promise.all([
    loadPlanningSources({ to: horizon }),
    loadCalendarOccurrences(today, addCivilDays(today, 7)),
  ]);
  return {
    today,
    entries: buildHouseholdAgenda({
      today,
      projects: sources.projects,
      tasks: sources.tasks,
      bookings: sources.bookings,
      commitments: sources.commitments,
      events: calendar.items,
      members: sources.members,
    }),
    warnings: calendar.warnings.map(({ id, title }) => ({ id, title })),
    syncAttention: calendar.attention.length,
  };
}
export type HouseholdAgendaModel = Awaited<
  ReturnType<typeof loadHouseholdAgenda>
>;
