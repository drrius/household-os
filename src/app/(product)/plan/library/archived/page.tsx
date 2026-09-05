import {
  archivedMealPage,
  loadArchivedLibraryMeals,
} from "@/lib/meals/library-archive";
import { mealDate } from "@/lib/forms/meal-navigation";
import { ArchivedLibraryList } from "@/ui/plan/archived-library-list";
export default async function ArchivedMealsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; date?: string }>;
}) {
  const params = await searchParams;
  const library = await loadArchivedLibraryMeals(archivedMealPage(params.page));
  return <ArchivedLibraryList library={library} date={mealDate(params.date)} />;
}
