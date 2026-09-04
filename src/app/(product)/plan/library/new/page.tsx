import { notFound, redirect } from "next/navigation";

import { mealDate, mealPlanHref } from "@/lib/forms/meal-navigation";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { FormPage } from "@/ui/forms/form-page";
import { LibraryMealForm } from "@/ui/plan/library-meal-form";

export default async function NewLibraryMealPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; from?: string }>;
}) {
  const query = await searchParams;
  const date = mealDate(query.date);
  const source = query.from ? await loadManageMealEntry(query.from) : null;
  if (query.from && !source) notFound();
  if (source?.libraryId)
    redirect(`/plan/library/${source.libraryId}?date=${date}`);
  return (
    <FormPage
      title="Save a meal"
      backHref={source ? `/plan/meals/${source.id}` : mealPlanHref(date)}
      description="Keep a favourite for next time. After saving, add the groceries you usually need."
    >
      <LibraryMealForm
        date={date}
        initial={source ?? undefined}
        sourceEntryId={source?.id}
      />
    </FormPage>
  );
}
