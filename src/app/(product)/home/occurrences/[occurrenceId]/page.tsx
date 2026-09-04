import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { loadOccurrenceDetail } from "@/lib/routines/occurrence-detail";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { OccurrenceActions } from "@/ui/today/occurrence-actions";

function RoutineInstructions({
  instructions,
}: {
  instructions: string | null;
}) {
  return (
    <>
      {instructions ? (
        <section className="grid gap-2">
          <h2 className="font-heading text-lg font-semibold">Good to know</h2>
          <p className="whitespace-pre-wrap wrap-anywhere">{instructions}</p>
        </section>
      ) : null}
    </>
  );
}

function OccurrenceWork({
  model,
}: {
  model: Awaited<ReturnType<typeof loadOccurrenceDetail>>;
}) {
  const { occurrence, completion } = model;
  return (
    <>
      {model.canAct ? (
        <OccurrenceActions id={occurrence.id} dueDate={occurrence.due_date} />
      ) : (
        <div className="grid gap-2 rounded-xl bg-muted p-4">
          <p className="font-medium">
            {completion
              ? `Completed by ${model.completedBy}`
              : occurrence.status === "skipped"
                ? "Skipped this time"
                : "No action needed"}
          </p>
          {completion ? (
            <p className="text-base text-muted-foreground sm:text-sm">
              {formatZurichDayLabel(completion.completed_on)}
            </p>
          ) : null}
          {completion?.photo_path ? (
            <a
              href={`/api/attachments?path=${encodeURIComponent(completion.photo_path)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              View completion photo
            </a>
          ) : null}
          {completion?.note ? (
            <p className="whitespace-pre-wrap wrap-anywhere">
              {completion.note}
            </p>
          ) : null}
        </div>
      )}
    </>
  );
}

export default async function OccurrencePage({
  params,
  searchParams,
}: {
  params: Promise<{ occurrenceId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ occurrenceId }, query] = await Promise.all([params, searchParams]);
  const model = await loadOccurrenceDetail(occurrenceId);
  const { occurrence } = model;
  return (
    <AppPage labelledBy="occurrence-title">
      <div className="grid w-full max-w-2xl gap-6">
        <PageHeader
          title={occurrence.routine.title}
          titleId="occurrence-title"
          trailing={
            <Link className={buttonVariants({ variant: "outline" })} href="/">
              Back to Today
            </Link>
          }
        />
        {query.saved ? (
          <p role="status" className="rounded-xl bg-success-soft p-3">
            Saved. Both of you will see the update.
          </p>
        ) : null}
        <div className="grid gap-1 text-base sm:text-sm">
          <p className="font-medium">
            {model.owner} · {formatZurichDayLabel(occurrence.due_date)}
          </p>
          {occurrence.due_date !== occurrence.original_due_date ? (
            <p className="text-muted-foreground">
              Moved from {formatZurichDayLabel(occurrence.original_due_date)}
            </p>
          ) : null}
          {occurrence.routine.paused_at ? (
            <p className="text-muted-foreground">This routine is paused.</p>
          ) : null}
        </div>
        <RoutineInstructions instructions={occurrence.routine.instructions} />
        <OccurrenceWork model={model} />
        {!occurrence.routine.archived_at ? (
          <Link href={`/home/routines/${occurrence.routine_id}/edit`}>
            Edit the repeating routine
          </Link>
        ) : (
          <p className="text-muted-foreground">
            This routine is archived. Its history is kept here.
          </p>
        )}
      </div>
    </AppPage>
  );
}
