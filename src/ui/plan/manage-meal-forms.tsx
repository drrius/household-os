import { updateMealEntryAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { FormField, FormFields, selectClassName } from "@/ui/forms/form-page";
import { RemoveMealButton } from "@/ui/plan/remove-meal-button.client";

const RECIPE_URL_HINT = "Must start with http:// or https://";

function MealEditFields({ entry }: { entry: ManageMealEntry }) {
  const slot = entry.slot ?? "dinner";
  return (
    <>
      <FormField label="Meal">
        <Input
          defaultValue={entry.title}
          maxLength={120}
          name="title"
          required
        />
      </FormField>
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Date">
          <Input defaultValue={entry.date} name="date" required type="date" />
        </FormField>
        <FormField label="Slot">
          <select className={selectClassName} defaultValue={slot} name="slot">
            <option value="breakfast">Breakfast</option>
            <option value="lunch">Lunch</option>
            <option value="dinner">Dinner</option>
          </select>
        </FormField>
      </div>
      <FormField description={RECIPE_URL_HINT} label="Recipe link" optional>
        <Input
          defaultValue={entry.recipeUrl ?? ""}
          maxLength={2000}
          name="recipeUrl"
          type="url"
        />
      </FormField>
      <FormField label="Notes" optional>
        <Textarea
          defaultValue={entry.notes ?? ""}
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
        entryId={entry.id}
        // Generated on the server so the client component never has to, which
        // would not survive hydration.
        idempotencyKey={crypto.randomUUID()}
        title={entry.title}
      />
    </div>
  );
}
