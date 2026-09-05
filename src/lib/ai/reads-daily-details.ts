import "server-only";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { loadMealConnections } from "@/lib/meals/details";
import { loadMealPreparation } from "@/lib/meals/preparation";
import { loadOccurrenceDetail } from "@/lib/routines/occurrence-detail";
import { loadRoutineHistory } from "@/lib/routines/history";
import { dailyDetailSchemas as schemas } from "./definitions/daily-detail-tools";
export async function readDailyDetail(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_meal_entry") {
    const { entryId } = schemas.get_meal_entry.parse(input);
    const meal = await loadManageMealEntry(entryId, true);
    if (!meal) throw new Error("This planned meal is unavailable.");
    const [connections, preparation] = await Promise.all([
      loadMealConnections(entryId),
      loadMealPreparation(entryId),
    ]);
    return { meal, connections, preparation };
  }
  if (name === "get_routine_occurrence")
    return loadOccurrenceDetail(
      schemas.get_routine_occurrence.parse(input).occurrenceId,
    );
  const { routineId, page } = schemas.get_routine_history.parse(input);
  return loadRoutineHistory(routineId, page);
}
