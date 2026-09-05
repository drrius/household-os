import { notFound } from "next/navigation";

import { createMealPreparationAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { loadRoutineFormOptions } from "@/lib/forms/options";
import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { DateField } from "@/ui/forms/date-field.client";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields, FormPage } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

export default async function MealPrepPage({
  params,
}: {
  params: Promise<{ entryId: string }>;
}) {
  const { entryId } = await params;
  const entry = await loadManageMealEntry(entryId);
  if (!entry) notFound();
  const { areas, members } = await loadRoutineFormOptions();
  return (
    <FormPage
      title="Prepare ahead"
      backHref={`/plan/meals/${entry.id}`}
      description={`Add one preparation task for ${entry.title}. It will appear on Today when it’s due.`}
    >
      <FormFields
        action={createMealPreparationAction}
        submitLabel="Add prep task"
      >
        <input type="hidden" name="entryId" value={entry.id} />
        <input
          type="hidden"
          name="idempotencyKey"
          value={crypto.randomUUID()}
        />
        <FormField label="What needs doing?">
          <EchoedInput
            name="title"
            maxLength={120}
            placeholder="e.g. Take the dough out of the freezer"
            required
          />
        </FormField>
        <DateField
          name="dueOn"
          label="Do it on"
          defaultValue={entry.date}
          required
        />
        <FormField label="Who’s doing it?">
          <EchoedSelect
            name="assignedMemberId"
            initialValue=""
            items={[
              { value: "", label: "Either of us" },
              ...members.map((member) => ({
                value: member.user_id,
                label: member.display_name,
              })),
            ]}
          />
        </FormField>
        <FormField label="Area">
          <EchoedSelect
            name="areaId"
            initialValue={
              areas.find((area) => area.name === "Meals")?.id ??
              areas[0]?.id ??
              ""
            }
            items={areas.map((area) => ({ value: area.id, label: area.name }))}
          />
        </FormField>
        <FormField label="Instructions" optional>
          <EchoedTextarea name="instructions" maxLength={4000} />
        </FormField>
      </FormFields>
    </FormPage>
  );
}
