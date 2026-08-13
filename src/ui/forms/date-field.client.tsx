"use client";

import { useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Native date controls format per browser and OS locale, so `08/12/2026` is
 * ambiguous in Zurich and the product cannot control the order through the
 * control itself. The unambiguous reading is echoed below the field instead.
 */
function dayEcho(value: string): string | null {
  if (!isoDatePattern.test(value)) return null;
  try {
    return `${formatZurichDayLabel(value)} ${value.slice(0, 4)}`;
  } catch {
    return null;
  }
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
  const { values } = useFormFieldsState();
  const [value, setValue] = useState(values[name] ?? defaultValue);
  const echo = dayEcho(value);
  const fieldDescription =
    echo === null ? (
      description
    ) : description ? (
      <>
        {echo}. {description}
      </>
    ) : (
      echo
    );

  return (
    <FormField
      description={fieldDescription}
      label={label}
      name={name}
      optional={optional}
    >
      <Input
        defaultValue={value}
        name={name}
        onChange={(event) => setValue(event.target.value)}
        required={required}
        type="date"
      />
    </FormField>
  );
}
