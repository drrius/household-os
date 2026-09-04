"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import {
  initialFormActionState,
  type FormAction,
} from "@/lib/forms/action-state";

export function MoneyCommandForm({
  action,
  fields,
  idempotencyKey,
  label,
}: {
  action: FormAction;
  fields: Readonly<Record<string, string>>;
  idempotencyKey: string;
  label: string;
}) {
  const [state, submit, pending] = useActionState(
    action,
    initialFormActionState,
  );
  return (
    <form action={submit} className="grid gap-2">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} name={name} type="hidden" value={value} />
      ))}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "Saving…" : label}
      </Button>
      {state.error ? (
        <p role="alert" className="max-w-sm text-sm text-destructive-strong">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
