"use client";
import { useActionState } from "react";
import { buttonVariants } from "@/components/ui/button";
import {
  initialFormActionState,
  type FormAction,
} from "@/lib/forms/action-state";
export function CalendarActionButton({
  action,
  label,
  pendingLabel = "Working…",
  successLabel,
}: {
  action: FormAction;
  label: string;
  pendingLabel?: string;
  successLabel?: string;
}) {
  const [state, submit, pending] = useActionState(
    action,
    initialFormActionState,
  );
  return (
    <form action={submit} className="grid gap-2">
      <button
        className={buttonVariants({ variant: "outline" })}
        disabled={pending}
      >
        {pending ? pendingLabel : label}
      </button>
      <p
        aria-live="polite"
        className={
          state.error
            ? "text-sm text-destructive"
            : "text-sm text-muted-foreground"
        }
      >
        {state.error ?? (state.submissionId > 0 ? successLabel : "")}
      </p>
    </form>
  );
}
