"use client";

import { useState } from "react";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

export type FormSelectOption = {
  label: string;
  value: string;
};

const emptyItemValue = "__empty__";

function toItemValue(value: string): string {
  return value === "" ? emptyItemValue : value;
}

function fromItemValue(value: string): string {
  return value === emptyItemValue ? "" : value;
}

export function EchoedSelect({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  id,
  initialValue = "",
  items,
  name,
  onValueChange,
  required,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  id?: string;
  initialValue?: string;
  items: readonly FormSelectOption[];
  name: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
}) {
  return (
    <FormSelect
      aria-describedby={describedBy}
      aria-invalid={invalid}
      defaultValue={useFormFieldValue(name, initialValue)}
      id={id}
      items={items}
      name={name}
      onValueChange={onValueChange}
      required={required}
    />
  );
}

export function FormSelect({
  "aria-describedby": describedBy,
  "aria-invalid": invalid,
  defaultValue = "",
  id,
  items,
  name,
  onValueChange,
  required,
  value,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  defaultValue?: string;
  id?: string;
  items: readonly FormSelectOption[];
  name: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  value?: string;
}) {
  const [uncontrolled, setUncontrolled] = useState(value ?? defaultValue);
  const current = value ?? uncontrolled;
  const selectItems = items.map((item) => ({
    label: item.label,
    value: toItemValue(item.value),
  }));

  return (
    <>
      <input name={name} type="hidden" value={current} />
      <Select
        items={selectItems}
        onValueChange={(next) => {
          if (typeof next !== "string") return;
          const resolved = fromItemValue(next);
          if (value === undefined) setUncontrolled(resolved);
          onValueChange?.(resolved);
        }}
        required={required}
        value={toItemValue(current)}
      >
        <SelectTrigger
          aria-describedby={describedBy}
          aria-invalid={invalid}
          className="h-11 w-full md:h-9"
          id={id}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {selectItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </>
  );
}
