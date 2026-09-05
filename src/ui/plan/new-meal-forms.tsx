import {
  createMealAction,
  placeFromLibraryAction,
  placeLeftoverMealAction,
} from "@/app/(product)/_actions/m7-plan-groceries";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { mealPlanHref } from "@/lib/forms/meal-navigation";
import { MealPositionFields } from "@/ui/plan/meal-position-fields";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import {
  CheckboxField,
  FormField,
  FormFields,
  FormPage,
} from "@/ui/forms/form-page";

type SlotDefault = string | undefined;

const RECIPE_URL_HINT = "Must start with http:// or https://";

export function PlaceLibraryMealForm({
  date,
  libraryId,
  libraryTitle,
  slot,
}: {
  date?: string;
  libraryId: string;
  libraryTitle: string;
  slot: SlotDefault;
}) {
  return (
    <FormPage
      backHref={mealPlanHref(date || zurichCivilDate())}
      description="Choose when to cook it. Its default groceries will join your shared list."
      title="Place saved meal"
    >
      <FormFields
        protectChanges
        action={placeFromLibraryAction}
        submitLabel="Add to plan"
      >
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <input name="libraryId" type="hidden" value={libraryId} />
        <FormField label="Meal">
          <p className="text-sm font-normal">{libraryTitle}</p>
        </FormField>
        <MealPositionFields
          date={date || zurichCivilDate()}
          slot={slot === "idea" ? null : (slot ?? "dinner")}
        />
        <FormField label="Notes" optional>
          <EchoedTextarea maxLength={4000} name="notes" />
        </FormField>
      </FormFields>
    </FormPage>
  );
}

export function CreateMealForm({
  date,
  slot,
}: {
  date?: string;
  slot: SlotDefault;
}) {
  return (
    <FormPage
      backHref={mealPlanHref(date || zurichCivilDate())}
      description="Plan something to cook, eat out, or keep as an idea for this week."
      title="New meal"
    >
      <FormFields
        protectChanges
        action={createMealAction}
        submitLabel="Add to plan"
      >
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <FormField label="Meal">
          <EchoedInput maxLength={120} name="title" required />
        </FormField>
        <MealPositionFields
          date={date || zurichCivilDate()}
          slot={slot === "idea" ? null : (slot ?? "dinner")}
        />
        <FormField description={RECIPE_URL_HINT} label="Recipe link" optional>
          <EchoedInput maxLength={2000} name="recipeUrl" type="url" />
        </FormField>
        <FormField label="Notes" optional>
          <EchoedTextarea maxLength={4000} name="notes" />
        </FormField>
        <CheckboxField
          label="Save this meal to the library"
          name="saveToLibrary"
        />
      </FormFields>
    </FormPage>
  );
}

export function LeftoverMealForm({
  date,
  slot,
  source,
}: {
  date: string;
  slot: string;
  source: { id: string; title: string };
}) {
  return (
    <FormPage
      backHref={`/plan/meals/${source.id}`}
      title="Plan leftovers"
      description="Use an earlier meal again. No groceries will be added."
    >
      <FormFields
        protectChanges
        action={placeLeftoverMealAction}
        submitLabel="Plan leftovers"
      >
        <input type="hidden" name="leftoverOfEntryId" value={source.id} />
        <input
          type="hidden"
          name="idempotencyKey"
          value={crypto.randomUUID()}
        />
        <p className="font-heading text-xl font-semibold">{source.title}</p>
        <MealPositionFields date={date} slot={slot} allowIdea={false} />
        <FormField label="Notes" optional>
          <EchoedTextarea name="notes" maxLength={4000} />
        </FormField>
      </FormFields>
    </FormPage>
  );
}
