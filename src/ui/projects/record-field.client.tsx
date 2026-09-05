"use client";

import type { HTMLInputTypeAttribute } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

export function RecordField({
  name,
  label,
  initial = "",
  optional = false,
  type = "text",
  multiline = false,
  maxLength,
  description,
}: {
  name: string;
  label: string;
  initial?: string;
  optional?: boolean;
  type?: HTMLInputTypeAttribute;
  multiline?: boolean;
  maxLength?: number;
  description?: string;
}) {
  const value = useFormFieldValue(name, initial);
  return (
    <FormField
      label={label}
      name={name}
      optional={optional}
      description={description}
    >
      {multiline ? (
        <Textarea
          name={name}
          defaultValue={value}
          required={!optional}
          maxLength={maxLength}
          rows={4}
        />
      ) : (
        <Input
          name={name}
          type={type}
          defaultValue={value}
          required={!optional}
          maxLength={maxLength}
          inputMode={
            name === "budget" || name === "estimate" ? "decimal" : undefined
          }
        />
      )}
    </FormField>
  );
}

export function RecordSelect({
  name,
  label,
  initial,
  options,
  optional = false,
}: {
  name: string;
  label: string;
  initial: string;
  options: readonly { value: string; label: string }[];
  optional?: boolean;
}) {
  const value = useFormFieldValue(name, initial);
  return (
    <FormField label={label} name={name} optional={optional}>
      <select
        name={name}
        defaultValue={value}
        required={!optional}
        className="h-11 w-full rounded-xl border border-input bg-background px-3 text-base"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FormField>
  );
}
