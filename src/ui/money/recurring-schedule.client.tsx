"use client";
import { useState } from "react";
import type { MoneyRecurringRule } from "@/lib/read-models/money-recurring";
import { FormField } from "@/ui/forms/form-page";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
import { FormSelect } from "@/ui/forms/form-select.client";
import { EchoedInput } from "@/ui/forms/echoed-control.client";

export function RecurringScheduleFields({
  rule,
  today,
}: {
  rule: MoneyRecurringRule | null;
  today: string;
}) {
  const [kind, setKind] = useState(
    useFormFieldValue("scheduleKind", rule?.schedule_kind ?? "monthly"),
  );
  return (
    <>
      <FormField label="Frequency">
        <FormSelect
          name="scheduleKind"
          value={kind}
          onValueChange={setKind}
          items={[
            { label: "Every week", value: "weekly" },
            { label: "Every month", value: "monthly" },
          ]}
        />
      </FormField>
      {kind === "monthly" ? (
        <FormField
          label="Day of the month"
          description="Use 31 for the last available day in shorter months. The next draft date must match this day."
        >
          <EchoedInput
            name="dayOfMonth"
            type="number"
            min={1}
            max={31}
            required
            initialValue={String(rule?.day_of_month ?? Number(today.slice(-2)))}
          />
        </FormField>
      ) : (
        <p className="text-sm text-muted-foreground">
          Repeats on the same weekday as the next draft date.
        </p>
      )}
    </>
  );
}
