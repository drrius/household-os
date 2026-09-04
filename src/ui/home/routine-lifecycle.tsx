import { routineLifecycleAction } from "@/app/(product)/_actions/m7-routines";
import { FormFields } from "@/ui/forms/form-page";

export function RoutineLifecycle({
  routineId,
  paused,
}: {
  routineId: string;
  paused: boolean;
}) {
  return (
    <section
      className="grid gap-4 border-t pt-6"
      aria-labelledby="routine-lifecycle-title"
    >
      <h2
        className="font-heading text-lg font-semibold"
        id="routine-lifecycle-title"
      >
        Taking a break?
      </h2>
      <p className="text-base text-muted-foreground sm:text-sm">
        {paused
          ? "This routine is paused. Resume when you're ready; any unfinished occurrence is kept."
          : "Pausing keeps unfinished work and history, and stops reminders until you resume."}
      </p>
      <FormFields
        action={routineLifecycleAction}
        showRequiredNotice={false}
        submitVariant="outline"
        submitLabel={paused ? "Resume routine" : "Pause routine"}
      >
        <input type="hidden" name="routineId" value={routineId} />
        <input
          type="hidden"
          name="intent"
          value={paused ? "resume" : "pause"}
        />
      </FormFields>
      <details className="border-t pt-3">
        <summary className="min-h-11 cursor-pointer font-medium">
          Retire this routine
        </summary>
        <div className="grid gap-3">
          <p className="text-base text-muted-foreground sm:text-sm">
            Archive a routine you no longer need. Open occurrences are removed;
            completed and skipped history is kept. This cannot be resumed.
          </p>
          <FormFields
            action={routineLifecycleAction}
            showRequiredNotice={false}
            submitVariant="outline"
            submitLabel="Archive routine"
          >
            <input type="hidden" name="routineId" value={routineId} />
            <input type="hidden" name="intent" value="archive" />
          </FormFields>
        </div>
      </details>
    </section>
  );
}
