"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { useFormFieldsState } from "@/ui/forms/form-fields.client";
export function BookingSection({
  title,
  fields,
  initialOpen = false,
  children,
}: {
  title: string;
  fields: readonly string[];
  initialOpen?: boolean;
  children: ReactNode;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const state = useFormFieldsState();
  const reveal = fields.some(
    (name) =>
      Boolean(state.errors[name]) ||
      (Boolean(state.values[name]) && !name.endsWith("time_zone")),
  );
  useEffect(() => {
    if (reveal && details.current) details.current.open = true;
  }, [reveal, state.submissionId]);
  return (
    <details
      ref={details}
      open={initialOpen}
      className="rounded-xl border p-4"
      onInvalidCapture={() => {
        if (details.current) details.current.open = true;
      }}
    >
      <summary className="min-h-11 cursor-pointer content-center font-medium">
        {title}
      </summary>
      <div className="grid gap-5 pt-4">{children}</div>
    </details>
  );
}
