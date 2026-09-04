import { notFound } from "next/navigation";
import { loadRoutineFormOptions } from "@/lib/forms/options";
import { loadMealPreparation } from "@/lib/meals/preparation";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { FormPage } from "@/ui/forms/form-page";
import { MealPreparationEdit } from "@/ui/plan/meal-preparation-edit";
export default async function EditMealPreparationPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const entry = await loadManageMealEntry(entryId);
  if (!entry) notFound();
  const [prep, options] = await Promise.all([
    loadMealPreparation(entry.id),
    loadRoutineFormOptions(),
  ]);
  if (!prep) notFound();
  return (
    <FormPage
      title="Edit meal preparation"
      backHref={`/plan/meals/${entry.id}`}
      description={`One preparation task for ${entry.title}. Changing it keeps it linked to this meal.`}
    >
      <MealPreparationEdit
        entryId={entry.id}
        prep={prep}
        members={options.members}
        areas={options.areas}
      />
    </FormPage>
  );
}
