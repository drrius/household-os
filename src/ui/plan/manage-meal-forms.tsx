import {
  removeMealEntryAction,
  updateMealEntryAction,
} from "@/app/(product)/_actions/m7-plan-groceries";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { cn } from "@/lib/utils";
import { FormField, FormFields, selectClassName } from "@/ui/forms/form-page";

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
      <FormField label="Recipe link">
        <Input
          defaultValue={entry.recipeUrl ?? ""}
          maxLength={2000}
          name="recipeUrl"
          type="url"
        />
      </FormField>
      <FormField label="Notes">
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
      <form action={removeMealEntryAction} className="grid gap-3">
        <input name="entryId" type="hidden" value={entry.id} />
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <button
          className={cn(
            buttonVariants({ size: "lg", variant: "destructive" }),
            "w-full sm:w-fit",
          )}
          type="submit"
        >
          Remove from plan
        </button>
      </form>
    </div>
  );
}
