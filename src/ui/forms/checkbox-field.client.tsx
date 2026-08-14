"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

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
  const echoed = useFormFieldValue(name);
  const checked = echoed === "" ? Boolean(defaultChecked) : echoed === value;
  return (
    <label className="flex min-h-11 items-center gap-3 text-sm font-medium">
      <Checkbox defaultChecked={checked} name={name} value={value} />
      {label}
    </label>
  );
}
