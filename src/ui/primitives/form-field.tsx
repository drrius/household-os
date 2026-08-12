import type { ReactNode } from "react";

export type FormFieldProps = {
  children: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  id: string;
  label: ReactNode;
};

export function FormField({
  children,
  error,
  hint,
  id,
  label,
}: FormFieldProps) {
  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children}
      {hint !== undefined && hint !== null ? (
        <p className="field__hint" id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
      {error !== undefined && error !== null ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
