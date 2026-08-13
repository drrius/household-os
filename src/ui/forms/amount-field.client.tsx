"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { chfAmountMessage, parseChfToCentimesOrNull } from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

const chfPattern = String.raw`\d{1,13}([.,]\d{1,2})?`;

export function useAmountValue(
  name: string,
  defaultValue = "",
): [string, (value: string) => void] {
  const [value, setValue] = useState(useFormFieldValue(name, defaultValue));
  return [value, setValue];
}

function AmountInput({
  "aria-describedby": fieldDescribedBy,
  "aria-invalid": fieldInvalid,
  customValidity,
  describedById,
  id,
  invalid,
  maxCents,
  name,
  onValueChange,
  required,
  value,
}: {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  customValidity?: string;
  describedById?: string;
  id?: string;
  invalid?: boolean;
  maxCents?: number;
  name: string;
  onValueChange: (value: string) => void;
  required?: boolean;
  value: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const centimes = parseChfToCentimesOrNull(value);
  const unreadable = centimes === null && value.trim().length > 0;
  const overMaxMessage =
    maxCents !== undefined && centimes !== null && centimes > maxCents
      ? `Enter at most ${formatCentimesAsFrancs(maxCents)} — the current balance.`
      : "";
  const blocking = unreadable
    ? chfAmountMessage
    : overMaxMessage || customValidity || "";

  useEffect(() => {
    inputRef.current?.setCustomValidity(blocking);
  }, [blocking]);

  const describedBy =
    [fieldDescribedBy, describedById]
      .filter((token) => token !== null && token !== undefined)
      .join(" ") || undefined;

  return (
    <Input
      aria-describedby={describedBy}
      aria-invalid={fieldInvalid ?? invalid}
      autoComplete="off"
      id={id}
      inputMode="decimal"
      name={name}
      onChange={(event) => onValueChange(event.currentTarget.value)}
      pattern={chfPattern}
      placeholder="0.00"
      ref={inputRef}
      required={required}
      title={chfAmountMessage}
      value={value}
    />
  );
}

export function AmountField({
  customValidity,
  describedById,
  description,
  invalid,
  label,
  maxCents,
  name,
  onValueChange,
  optional,
  required,
  value,
}: {
  customValidity?: string;
  describedById?: string;
  description?: ReactNode;
  invalid?: boolean;
  label: ReactNode;
  maxCents?: number;
  name: string;
  onValueChange: (value: string) => void;
  optional?: boolean;
  required?: boolean;
  value: string;
}): ReactNode {
  return (
    <FormField
      description={description}
      label={label}
      name={name}
      optional={optional}
    >
      <AmountInput
        customValidity={customValidity}
        describedById={describedById}
        invalid={invalid}
        maxCents={maxCents}
        name={name}
        onValueChange={onValueChange}
        required={required}
        value={value}
      />
    </FormField>
  );
}
