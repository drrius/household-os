"use client";
import { useActionState } from "react";
import { markInboxPageReadAction } from "@/app/(product)/_actions/inbox";
import {
  encodeInboxCursor,
  type InboxContext,
} from "@/domain/notifications/inbox";
import type { FormAction } from "@/lib/forms/action-state";
import { Button } from "@/components/ui/button";
export function InboxReadControl({
  ids,
  label,
  context,
  action = markInboxPageReadAction,
}: {
  ids: readonly string[];
  label: string;
  context: InboxContext;
  action?: FormAction;
}) {
  const [state, submit, pending] = useActionState(action, { submissionId: 0 });
  return (
    <form action={submit} className="grid justify-items-start gap-2">
      {ids.map((id) => (
        <input key={id} type="hidden" name="notificationId" value={id} />
      ))}
      <input type="hidden" name="filter" value={context.filter} />
      <input
        type="hidden"
        name="cursor"
        value={context.cursor ? encodeInboxCursor(context.cursor) : ""}
      />
      <Button
        variant="outline"
        type="submit"
        disabled={pending}
        aria-label={label}
      >
        {pending ? "Marking read…" : label}
      </Button>
      {state.error ? (
        <p className="max-w-prose text-sm text-destructive-strong" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
