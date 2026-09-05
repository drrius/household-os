import { notFound } from "next/navigation";

import { mealDate } from "@/lib/forms/meal-navigation";
import { loadMealLibraryChoices } from "@/lib/meals/details";
import {
  loadLibraryMealTitle,
  loadManageMealEntry,
} from "@/lib/read-models/meal-entry-manage";
import { addCivilDays } from "@/lib/ui/zurich-date";
import {
  CreateMealForm,
  LeftoverMealForm,
  PlaceLibraryMealForm,
} from "@/ui/plan/new-meal-forms";
import { MealLibraryList } from "@/ui/plan/meal-library-list.client";

export default async function NewMealPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    libraryId?: string;
    slot?: string;
    leftoverOf?: string;
  }>;
}) {
  const query = await searchParams;
  const slot = ["breakfast", "lunch", "dinner", "idea"].includes(
    query.slot ?? "",
  )
    ? query.slot!
    : "dinner";
  const date = mealDate(query.date);
  if (query.leftoverOf) {
    const source = await loadManageMealEntry(query.leftoverOf);
    if (!source || source.isLeftover || source.slot === null) notFound();
    return (
      <LeftoverMealForm
        date={mealDate(query.date, addCivilDays(source.date, 1))}
        slot={slot === "idea" ? "dinner" : slot}
        source={source}
      />
    );
  }
  if (query.libraryId) {
    const libraryTitle = await loadLibraryMealTitle(query.libraryId);
    if (!libraryTitle) notFound();
    return (
      <PlaceLibraryMealForm
        date={date}
        libraryId={query.libraryId}
        libraryTitle={libraryTitle}
        slot={slot}
      />
    );
  }
  const library = await loadMealLibraryChoices();
  return (
    <div className="grid gap-5">
      {library.length ? (
        <details className="max-w-2xl rounded-xl border p-4">
          <summary className="cursor-pointer py-2 font-medium">
            Choose a saved meal
          </summary>
          <div className="pt-4">
            <MealLibraryList meals={library} date={date} slot={slot} choosing />
          </div>
        </details>
      ) : null}
      <CreateMealForm date={date} slot={slot} />
    </div>
  );
}
