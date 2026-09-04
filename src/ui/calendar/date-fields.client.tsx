"use client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { FormField } from "@/ui/forms/form-page";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
export function CalendarDateFields({
  start,
  end,
  allDay,
}: {
  start: string;
  end: string;
  allDay: boolean;
}) {
  const savedAllDay = useFormFieldValue("allDay", allDay ? "on" : "");
  const [isAllDay, setAllDay] = useState(savedAllDay === "on");
  const savedStart = useFormFieldValue("start", start);
  const savedEnd = useFormFieldValue("end", end);
  const [startValue, setStart] = useState(savedStart);
  const [endValue, setEnd] = useState(savedEnd);
  return (
    <>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input
          type="checkbox"
          name="allDay"
          checked={isAllDay}
          onChange={(event) => {
            setAllDay(event.target.checked);
            setStart(
              event.target.checked
                ? startValue.slice(0, 10)
                : `${startValue.slice(0, 10)}T09:00`,
            );
            setEnd(
              event.target.checked
                ? endValue.slice(0, 10)
                : `${endValue.slice(0, 10)}T10:00`,
            );
          }}
          className="size-5 accent-primary"
        />{" "}
        All day
      </label>
      <div className="grid gap-4 @sm:grid-cols-2">
        <FormField label={isAllDay ? "First day" : "Starts"}>
          <Input
            name="start"
            type={isAllDay ? "date" : "datetime-local"}
            value={isAllDay ? startValue.slice(0, 10) : startValue}
            onChange={(event) => setStart(event.target.value)}
            required
          />
        </FormField>
        <FormField label={isAllDay ? "Last day" : "Ends"}>
          <Input
            name="end"
            type={isAllDay ? "date" : "datetime-local"}
            value={isAllDay ? endValue.slice(0, 10) : endValue}
            onChange={(event) => setEnd(event.target.value)}
            required
          />
        </FormField>
      </div>
    </>
  );
}
