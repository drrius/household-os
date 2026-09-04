import type { FormAction } from "@/lib/forms/action-state";
import { RoutinePhotoField } from "@/ui/forms/routine-photo-field.client";
import { updateOccurrenceAction } from "@/app/(product)/_actions/routines";
import { RoutineCompletionNote } from "@/ui/forms/routine-completion-note.client";
import { DateField } from "@/ui/forms/date-field.client";
import { FormFields } from "@/ui/forms/form-page";

function OccurrenceFields({ id, intent }: { id: string; intent: string }) {
  return (
    <>
      <input type="hidden" name="occurrenceId" value={id} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
    </>
  );
}

export function OccurrenceActions({
  id,
  dueDate,
  action = updateOccurrenceAction,
}: {
  id: string;
  dueDate: string;
  action?: FormAction;
}) {
  return (
    <div className="grid gap-6">
      <section className="grid gap-3" aria-label="Complete routine">
        <h2 className="font-heading text-lg font-semibold">Taken care of?</h2>
        <FormFields
          action={action}
          submitLabel="Mark done"
          showRequiredNotice={false}
        >
          <OccurrenceFields id={id} intent="complete" />
          <RoutineCompletionNote />
          <RoutinePhotoField />
        </FormFields>
      </section>
      <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer font-medium">
          Move to another day
        </summary>
        <div className="grid gap-3 pb-2">
          <p className="text-base text-muted-foreground sm:text-sm">
            Only this occurrence moves. The regular schedule stays the same.
          </p>
          <FormFields
            action={action}
            submitLabel="Move this occurrence"
            showRequiredNotice={false}
            submitVariant="outline"
          >
            <OccurrenceFields id={id} intent="reschedule" />
            <DateField
              label="New date"
              name="newDueDate"
              defaultValue={dueDate}
              required
            />
          </FormFields>
        </div>
      </details>
      <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer font-medium">
          Skip this time
        </summary>
        <div className="grid gap-3 pb-2">
          <p className="text-base text-muted-foreground sm:text-sm">
            This is recorded as skipped. The next occurrence keeps its regular
            cadence.
          </p>
          <FormFields
            action={action}
            submitLabel="Skip this occurrence"
            showRequiredNotice={false}
            submitVariant="outline"
          >
            <OccurrenceFields id={id} intent="skip" />
          </FormFields>
        </div>
      </details>
    </div>
  );
}
