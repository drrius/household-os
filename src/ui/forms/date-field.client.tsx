"use client";

import { CalendarIcon } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const emptyDateMessage = "Choose a date.";

function isoToCalendarDate(iso: string): Date | undefined {
  if (!isoDatePattern.test(iso)) return undefined;
  const [year, month, day] = iso.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) {
    return undefined;
  }
  return new Date(year, month - 1, day);
}

function calendarDateToIso(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dayEcho(value: string): string | null {
  if (!isoDatePattern.test(value)) return null;
  try {
    return `${formatZurichDayLabel(value)} ${value.slice(0, 4)}`;
  } catch {
    return null;
  }
}

function DatePickerControl({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  id,
  name,
  onValueChange,
  required,
  value,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  id?: string;
  name: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const selected = isoToCalendarDate(value);
  const echo = dayEcho(value);
  const missing = required === true && !isoDatePattern.test(value);
  const postedRef = useRef<HTMLInputElement>(null);
  const bindPosted = (node: HTMLInputElement | null) => {
    postedRef.current = node;
    node?.setCustomValidity(missing ? emptyDateMessage : "");
  };

  useEffect(() => {
    postedRef.current?.setCustomValidity(missing ? emptyDateMessage : "");
  }, [missing]);

  return (
    <div className="grid gap-2">
      <input
        aria-hidden
        className="sr-only"
        name={name}
        onChange={() => undefined}
        ref={bindPosted}
        required={required}
        tabIndex={-1}
        value={value}
      />
      <Popover>
        <PopoverTrigger
          render={
            <Button
              aria-describedby={describedBy}
              aria-invalid={invalid}
              className="w-full justify-start font-normal"
              id={id}
              type="button"
              variant="outline"
            />
          }
        >
          <CalendarIcon data-icon="inline-start" />
          {echo ?? "Pick a date"}
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (date !== undefined) onValueChange(calendarDateToIso(date));
            }}
            selected={selected}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export function DateField({
  defaultValue,
  description,
  label,
  name,
  optional,
  required,
}: {
  defaultValue: string;
  description?: ReactNode;
  label: string;
  name: string;
  optional?: boolean;
  required?: boolean;
}): ReactNode {
  const [value, setValue] = useState(useFormFieldValue(name, defaultValue));

  return (
    <FormField
      description={description}
      label={label}
      name={name}
      optional={optional}
    >
      <DatePickerControl
        name={name}
        onValueChange={setValue}
        required={required}
        value={value}
      />
    </FormField>
  );
}
