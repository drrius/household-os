"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

import { Input } from "@/components/ui/input";
import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { FormField } from "@/ui/forms/form-field.client";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";

/** Mirrors `parseChfToCentimes`, so letters never survive a round trip. */
const chfPattern = String.raw`\d{1,13}([.,]\d{1,2})?`;
const formatMessage = "Enter francs and centimes, for example 1234.50.";

/** Seeds controlled CHF state from the value echoed back by a rejected submit. */
export function useAmountValue(
  name: string,
  defaultValue = "",
): [string, Dispatch<SetStateAction<string>>] {
  const { values } = useFormFieldsState();
  return useState(values[name] ?? defaultValue);
}

type AmountInputProps = {
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
};

/**
 * `FormField` also clones a `defaultValue` in when the server echoed one back;
 * it is deliberately ignored here because the value is controlled and already
 * seeded from that same echo by `useAmountValue`.
 */
function AmountInput(props: AmountInputProps) {
  const {
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
  } = props;
  const messageId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [showsFormatMessage, setShowsFormatMessage] = useState(false);
  const { errors } = useFormFieldsState();
  const centimes = parseChfToCentimesOrNull(value);
  const unreadable = centimes === null && value.trim().length > 0;
  const overMaxMessage =
    maxCents !== undefined && centimes !== null && centimes > maxCents
      ? `Enter at most ${formatCentimesAsFrancs(maxCents)} — the current balance.`
      : "";
  const blocking = unreadable
    ? formatMessage
    : overMaxMessage || customValidity || "";
  // The blocking rule lives on the control itself, so the browser stops the
  // submit and `FormFields` keeps the message under the field afterwards.
  useEffect(() => {
    inputRef.current?.setCustomValidity(blocking);
  }, [blocking]);
  // Suppress the local copy once the same sentence is rendered by FormField.
  const message =
    showsFormatMessage && errors[name] !== formatMessage ? formatMessage : null;
  const describedBy =
    [fieldDescribedBy, describedById, message === null ? null : messageId]
      .filter((token) => token !== null && token !== undefined)
      .join(" ") || undefined;

  return (
    <>
      <Input
        aria-describedby={describedBy}
        aria-invalid={
          fieldInvalid ?? invalid ?? (message === null ? undefined : true)
        }
        autoComplete="off"
        id={id}
        inputMode="decimal"
        name={name}
        onBlur={(event) =>
          setShowsFormatMessage(event.currentTarget.validity.patternMismatch)
        }
        onChange={(event) => {
          onValueChange(event.currentTarget.value);
          if (showsFormatMessage) {
            setShowsFormatMessage(event.currentTarget.validity.patternMismatch);
          }
        }}
        pattern={chfPattern}
        placeholder="0.00"
        ref={inputRef}
        required={required}
        value={value}
      />
      {message === null ? null : (
        <span
          className="font-normal text-destructive-strong"
          id={messageId}
          role="alert"
        >
          {message}
        </span>
      )}
    </>
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
