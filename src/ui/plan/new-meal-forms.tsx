import {
  createMealAction,
  placeFromLibraryAction,
} from "@/app/(product)/_actions/m7-plan-groceries";
import { planDayHref } from "@/lib/ui/destinations";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { DateField } from "@/ui/forms/date-field.client";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import {
  CheckboxField,
  FormField,
  FormFields,
  FormPage,
} from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

type SlotDefault = string | undefined;

const RECIPE_URL_HINT = "Must start with http:// or https://";

const slotItems = [
  { label: "Breakfast", value: "breakfast" },
  { label: "Lunch", value: "lunch" },
  { label: "Dinner", value: "dinner" },
] as const;

// Cancelling returns to the day the slot was tapped on, not to today's week.
function backToPlanHref(date?: string): string {
  return date === undefined || date === "" ? "/plan" : planDayHref(date);
}

function DateAndSlotFields({
  date,
  slot,
}: {
  date?: string;
  slot: SlotDefault;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DateField
        defaultValue={date || zurichCivilDate()}
        label="Date"
        name="date"
        required
      />
      <FormField label="Slot">
        <EchoedSelect
          initialValue={slot ?? "dinner"}
          items={[...slotItems]}
          name="slot"
        />
      </FormField>
    </div>
  );
}

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
      backHref={backToPlanHref(date)}
      description="Place a saved library meal into one weekly slot."
      title="Place saved meal"
    >
      <FormFields action={placeFromLibraryAction} submitLabel="Add to plan">
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <input name="libraryId" type="hidden" value={libraryId} />
        <FormField label="Meal">
          <p className="text-sm font-normal">{libraryTitle}</p>
        </FormField>
        <DateAndSlotFields date={date} slot={slot} />
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
      backHref={backToPlanHref(date)}
      description="Place a meal into one weekly slot and optionally keep it in the meal library."
      title="New meal"
    >
      <FormFields action={createMealAction} submitLabel="Add to plan">
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <FormField label="Meal">
          <EchoedInput maxLength={120} name="title" required />
        </FormField>
        <DateAndSlotFields date={date} slot={slot} />
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
