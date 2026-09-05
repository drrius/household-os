import { DateField } from "@/ui/forms/date-field.client";
import { FormField } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

export function MealPositionFields({
  date,
  slot,
  allowIdea = true,
}: {
  date: string;
  slot: string | null;
  allowIdea?: boolean;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <DateField defaultValue={date} label="Date" name="date" required />
      <FormField
        label="Meal time"
        description={
          allowIdea
            ? "Ideas stay in this week until you choose a day."
            : undefined
        }
      >
        <EchoedSelect
          initialValue={slot ?? "idea"}
          name="slot"
          items={[
            { label: "Breakfast", value: "breakfast" },
            { label: "Lunch", value: "lunch" },
            { label: "Dinner", value: "dinner" },
            ...(allowIdea
              ? [{ label: "Decide later · idea for this week", value: "idea" }]
              : []),
          ]}
        />
      </FormField>
    </div>
  );
}
