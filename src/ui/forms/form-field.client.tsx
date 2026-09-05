"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type ReactNode,
} from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";

type ControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  id?: string;
  name?: string;
};

export function FormField({
  children,
  description,
  label,
  name,
  optional,
}: {
  children: ReactNode;
  description?: ReactNode;
  label: ReactNode;
  name?: string;
  optional?: boolean;
}) {
  const id = useId();
  const controlId = `${id}-control`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const { errors } = useFormFieldsState();
  // Server-rendered children can arrive through React's lazy child wrapper.
  // Normalize with its public Children API before checking the control.
  const childrenArray = Children.toArray(children);
  const child = childrenArray.length === 1 ? childrenArray[0] : null;
  const control = isValidElement<ControlProps>(child) ? child : null;
  const field = name ?? control?.props.name;
  const error = field === undefined ? undefined : errors[field];
  const describedBy =
    [description ? descriptionId : null, error === undefined ? null : errorId]
      .filter((value) => value !== null)
      .join(" ") || undefined;

  return (
    <Field data-invalid={error === undefined ? undefined : true}>
      <FieldLabel
        className="flex w-full items-baseline justify-between gap-2"
        htmlFor={controlId}
      >
        <span>{label}</span>
        {optional ? (
          <span className="font-normal text-muted-foreground">Optional</span>
        ) : null}
      </FieldLabel>
      {control === null
        ? children
        : cloneElement(control, {
            "aria-describedby": describedBy,
            "aria-invalid": error === undefined ? undefined : true,
            id: controlId,
          })}
      {description ? (
        <FieldDescription id={descriptionId}>{description}</FieldDescription>
      ) : null}
      {error === undefined ? null : (
        <FieldError className="text-destructive-strong" id={errorId}>
          {error}
        </FieldError>
      )}
    </Field>
  );
}
