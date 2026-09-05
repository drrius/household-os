"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

import { removeMealEntryAction } from "@/app/(product)/_actions/m7-plan-groceries";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

type RemoveMealButtonProps = {
  dateLabel: string;
  date?: string;
  entryId: string;
  idempotencyKey: string;
  title: string;
};

function RemoveSubmit() {
  const { pending } = useFormStatus();
  return (
    <button
      className={cn(buttonVariants({ variant: "destructive" }), "w-full")}
      disabled={pending}
      type="submit"
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}

export function RemoveMealButton({
  dateLabel,
  date,
  entryId,
  idempotencyKey,
  title,
}: RemoveMealButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        className={cn(
          buttonVariants({ size: "lg", variant: "outline" }),
          "w-full sm:w-fit",
        )}
        onClick={() => {
          setOpen(true);
        }}
        type="button"
      >
        Remove from plan
      </button>
      <ConfirmDialog
        cancelLabel="Keep it"
        // The action redirects to the plan, so the form closes the dialog by
        // navigating away rather than by flipping `open`.
        confirmSlot={
          <form action={removeMealEntryAction}>
            <input name="date" type="hidden" value={date ?? ""} />
            <input name="entryId" type="hidden" value={entryId} />
            <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
            <RemoveSubmit />
          </form>
        }
        description={`“${title}” on ${dateLabel} leaves the plan, and any preparation task for it is cancelled with it. This cannot be undone.`}
        onOpenChange={setOpen}
        open={open}
        title="Remove this meal from the plan?"
      />
    </>
  );
}
