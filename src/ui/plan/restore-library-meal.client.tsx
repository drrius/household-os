"use client";
import { useActionState } from "react";
import { restoreLibraryMealAction } from "@/app/(product)/plan/library/actions";
import type { FormActionState } from "@/lib/forms/action-state";
import { Button } from "@/components/ui/button";
export function RestoreLibraryMeal({
  id,
  date,
  action = restoreLibraryMealAction,
}: {
  id: string;
  date: string;
  action?: (
    previous: FormActionState,
    form: FormData,
  ) => Promise<FormActionState>;
}) {
  const [state, submit, pending] = useActionState(action, { submissionId: 0 });
  return (
    <form action={submit} className="grid justify-items-start gap-2">
      <input type="hidden" name="libraryId" value={id} />
      <input type="hidden" name="date" value={date} />
      <Button type="submit" disabled={pending}>
        {pending ? "Restoring…" : "Restore meal"}
      </Button>
      {state.error ? (
        <p role="alert" className="text-destructive-strong">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
