import { notFound } from "next/navigation";

import { mealDate } from "@/lib/forms/meal-navigation";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { FormPage } from "@/ui/forms/form-page";
import { ManageMealForms } from "@/ui/plan/manage-meal-forms";

export default async function EditMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ error?: string; day?: string }>;
}) {
  const { entryId } = await params;
  const entry = await loadManageMealEntry(entryId);
  if (!entry) notFound();
  const query = await searchParams;
  return (
    <FormPage
      backHref={`/plan/meals/${entry.id}?day=${mealDate(query.day, entry.date)}`}
      description="Update this meal. Saved library meals keep their own details."
      error={query.error}
      title={`Edit ${entry.title}`}
    >
      <ManageMealForms entry={entry} />
    </FormPage>
  );
}
