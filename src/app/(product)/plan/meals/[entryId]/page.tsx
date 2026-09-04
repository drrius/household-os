import { notFound } from "next/navigation";

import { mealDate } from "@/lib/forms/meal-navigation";
import { loadMealConnections } from "@/lib/meals/details";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { MealDetails } from "@/ui/plan/meal-details";

export default async function MealPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { entryId } = await params;
  const entry = await loadManageMealEntry(entryId);
  if (entry === null) notFound();
  const connections = await loadMealConnections(entry.id);
  const { day } = await searchParams;
  return (
    <MealDetails
      entry={entry}
      connections={connections}
      day={mealDate(day, entry.date)}
    />
  );
}
