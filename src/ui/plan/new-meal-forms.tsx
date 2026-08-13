import {
  createMealAction,
  placeFromLibraryAction,
} from "@/app/(product)/_actions/m7-plan-groceries";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import {
  CheckboxField,
  FormField,
  FormFields,
  FormPage,
  selectClassName,
} from "@/ui/forms/form-page";

type SlotDefault = string | undefined;

const RECIPE_URL_HINT = "Must start with http:// or https://";

function DateAndSlotFields({
  date,
  slot,
}: {
  date?: string;
  slot: SlotDefault;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <FormField label="Date">
        <Input
          defaultValue={date ?? zurichCivilDate()}
          name="date"
          required
          type="date"
        />
      </FormField>
      <FormField label="Slot">
        <select className={selectClassName} defaultValue={slot} name="slot">
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
        </select>
      </FormField>
    </div>
  );
}

export function PlaceLibraryMealForm({
  date,
  error,
  libraryId,
  libraryTitle,
  slot,
}: {
  date?: string;
  error?: string;
  libraryId: string;
  libraryTitle: string;
  slot: SlotDefault;
}) {
  return (
    <FormPage
      backHref="/plan"
      description="Place a saved library meal into one weekly slot."
      error={error}
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
          <Textarea maxLength={4000} name="notes" />
        </FormField>
      </FormFields>
    </FormPage>
  );
}

export function CreateMealForm({
  date,
  error,
  slot,
}: {
  date?: string;
  error?: string;
  slot: SlotDefault;
}) {
  return (
    <FormPage
      backHref="/plan"
      description="Place a meal into one weekly slot and optionally keep it in the meal library."
      error={error}
      title="New meal"
    >
      <FormFields action={createMealAction} submitLabel="Add to plan">
        <input
          name="idempotencyKey"
          type="hidden"
          value={crypto.randomUUID()}
        />
        <FormField label="Meal">
          <Input maxLength={120} name="title" required />
        </FormField>
        <DateAndSlotFields date={date} slot={slot} />
        <FormField description={RECIPE_URL_HINT} label="Recipe link" optional>
          <Input maxLength={2000} name="recipeUrl" type="url" />
        </FormField>
        <FormField label="Notes" optional>
          <Textarea maxLength={4000} name="notes" />
        </FormField>
        <CheckboxField
          label="Save this meal to the library"
          name="saveToLibrary"
        />
      </FormFields>
    </FormPage>
  );
}
