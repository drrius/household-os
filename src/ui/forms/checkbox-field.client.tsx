"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";

export function CheckboxField({
  defaultChecked,
  label,
  name,
  value = "on",
}: {
  defaultChecked?: boolean;
  label: string;
  name: string;
  value?: string;
}) {
  const { values, submissionId } = useFormFieldsState();
  const checked =
    submissionId === 0 ? Boolean(defaultChecked) : values[name] === value;
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <Checkbox defaultChecked={checked} name={name} value={value} />
      {label}
    </label>
  );
}
