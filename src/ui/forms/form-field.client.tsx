"use client";

import { cloneElement, isValidElement, useId, type ReactNode } from "react";

import { useFormFieldsState } from "@/ui/forms/form-fields.client";

/**
 * The subset of control props this component owns. `isValidElement` narrows the
 * child to this shape so `cloneElement` stays type-checked.
 */
type ControlProps = {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  defaultValue?: string;
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
  const { errors, values } = useFormFieldsState();
  const control = isValidElement<ControlProps>(children) ? children : null;
  const field = name ?? control?.props.name;
  const error = field === undefined ? undefined : errors[field];
  const echoed = field === undefined ? undefined : values[field];
  const describedBy =
    [description ? descriptionId : null, error === undefined ? null : errorId]
      .filter((value) => value !== null)
      .join(" ") || undefined;

  return (
    <div className="grid gap-2 text-sm font-medium">
      <label
        className="flex items-baseline justify-between gap-2"
        htmlFor={controlId}
      >
        <span>{label}</span>
        {optional ? (
          <span className="font-normal text-muted-foreground">Optional</span>
        ) : null}
      </label>
      {control === null
        ? children
        : cloneElement(control, {
            "aria-describedby": describedBy,
            "aria-invalid": error === undefined ? undefined : true,
            id: controlId,
            ...(echoed === undefined ? {} : { defaultValue: echoed }),
          })}
      {description ? (
        <span className="font-normal text-muted-foreground" id={descriptionId}>
          {description}
        </span>
      ) : null}
      {error === undefined ? null : (
        <span
          className="font-normal text-destructive-strong"
          id={errorId}
          role="alert"
        >
          {error}
        </span>
      )}
    </div>
  );
}
