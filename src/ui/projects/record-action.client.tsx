"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  initialFormActionState,
  type FormAction,
} from "@/lib/forms/action-state";

export function RecordAction({
  action,
  fields,
  label,
  pendingLabel = "Saving…",
}: {
  action: FormAction;
  fields: Readonly<Record<string, string>>;
  label: string;
  pendingLabel?: string;
}) {
  const [state, submit, pending] = useActionState(
    action,
    initialFormActionState,
  );
  return (
    <form action={submit} className="grid gap-2">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} value={value} type="hidden" />
      ))}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? pendingLabel : label}
      </Button>
      {state.error && (
        <p role="alert" className="max-w-sm text-sm text-destructive-strong">
          {state.error}
        </p>
      )}
    </form>
  );
}
