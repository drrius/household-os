"use client";
import { useActionState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { recordAction } from "@/app/(product)/home/record-actions";
import { buttonVariants } from "@/components/ui/button";
export function RecordChange({
  values,
  label,
  action = recordAction,
}: {
  values: Record<string, string>;
  label: string;
  action?: FormAction;
}) {
  const [state, submit, pending] = useActionState(action, { submissionId: 0 });
  return (
    <form action={submit} className="grid gap-2">
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <button
        type="submit"
        disabled={pending}
        className={buttonVariants({ variant: "outline" })}
      >
        {pending ? "Saving…" : label}
      </button>
      {state.error ? (
        <p role="alert" className="text-destructive-strong">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
