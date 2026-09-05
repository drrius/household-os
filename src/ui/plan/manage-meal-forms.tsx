import { updateMealEntryAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { Badge } from "@/components/ui/badge";
import type { ManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { MealPositionFields } from "@/ui/plan/meal-position-fields";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";

import { RemoveMealButton } from "@/ui/plan/remove-meal-button.client";

const RECIPE_URL_HINT = "Must start with http:// or https://";

function MealEditFields({ entry }: { entry: ManageMealEntry }) {
  return (
    <>
      <FormField label="Meal">
        <EchoedInput
          initialValue={entry.title}
          maxLength={120}
          name="title"
          required
        />
      </FormField>
      <MealPositionFields
        date={entry.date}
        slot={entry.slot}
        allowIdea={!entry.isLeftover}
      />
      <FormField description={RECIPE_URL_HINT} label="Recipe link" optional>
        <EchoedInput
          initialValue={entry.recipeUrl ?? ""}
          maxLength={2000}
          name="recipeUrl"
          type="url"
        />
      </FormField>
      <FormField label="Notes" optional>
        <EchoedTextarea
          initialValue={entry.notes ?? ""}
          maxLength={4000}
          name="notes"
        />
      </FormField>
    </>
  );
}

export function ManageMealForms({ entry }: { entry: ManageMealEntry }) {
  return (
    <div className="grid gap-5">
      {entry.isLeftover ? (
        <Badge className="w-fit" variant="warning">
          Leftover
        </Badge>
      ) : null}
      <FormFields action={updateMealEntryAction} submitLabel="Save changes">
        <input name="entryId" type="hidden" value={entry.id} />
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <MealEditFields entry={entry} />
      </FormFields>
      <RemoveMealButton
        dateLabel={formatZurichDayLabel(entry.date)}
        date={entry.date}
        entryId={entry.id}
        idempotencyKey={crypto.randomUUID()}
        title={entry.title}
      />
    </div>
  );
}
