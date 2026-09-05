import { notFound } from "next/navigation";

import { moveMealEntryAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { mealDate } from "@/lib/forms/meal-navigation";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { FormFields, FormPage } from "@/ui/forms/form-page";
import { MealPositionFields } from "@/ui/plan/meal-position-fields";

export default async function MoveMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ day?: string }>;
}) {
  const { entryId } = await params;
  const entry = await loadManageMealEntry(entryId);
  if (!entry) notFound();
  const { day } = await searchParams;
  return (
    <FormPage
      backHref={`/plan/meals/${entry.id}?day=${mealDate(day, entry.date)}`}
      title={entry.slot === null ? "Choose a day" : "Move meal"}
      description={`Choose when to have ${entry.title}. Existing prep dates stay the same; review them after moving.`}
    >
      <FormFields action={moveMealEntryAction} submitLabel="Move meal">
        <input type="hidden" name="entryId" value={entry.id} />
        <input
          type="hidden"
          name="idempotencyKey"
          value={crypto.randomUUID()}
        />
        <MealPositionFields
          date={entry.date}
          slot={entry.slot ?? "dinner"}
          allowIdea={!entry.isLeftover}
        />
      </FormFields>
    </FormPage>
  );
}
