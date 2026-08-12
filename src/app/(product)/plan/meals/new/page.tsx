import { createMealAction } from "@/app/(product)/_actions/m7-plan-groceries";
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

export default async function NewMealPage({
  searchParams,
}: {
  searchParams: Promise<{
    date?: string;
    error?: string;
    slot?: string;
  }>;
}) {
  const query = await searchParams;
  const slot = ["breakfast", "lunch", "dinner"].includes(query.slot ?? "")
    ? query.slot
    : "dinner";
  return (
    <FormPage
      backHref="/plan"
      description="Place a meal into one weekly slot and optionally keep it in the meal library."
      error={query.error}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Date">
            <Input
              defaultValue={query.date ?? zurichCivilDate()}
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
        <FormField label="Recipe link">
          <Input maxLength={2000} name="recipeUrl" type="url" />
        </FormField>
        <FormField label="Notes">
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
