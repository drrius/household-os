import Link from "next/link";
import { notFound } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";
import { loadRoutineHistory } from "@/lib/routines/history";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export default async function RoutineHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ routineId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const [{ routineId }, query] = await Promise.all([params, searchParams]);
  const page = Number(query.page ?? "0");
  if (!Number.isSafeInteger(page) || page < 0 || page > 10000) notFound();
  const model = await loadRoutineHistory(routineId, page);
  return (
    <AppPage labelledBy="history-title">
      <div className="grid w-full max-w-2xl gap-5">
        <PageHeader
          title={model.routine.title}
          titleId="history-title"
          trailing={
            <Link
              className={buttonVariants({ variant: "outline" })}
              href="/home"
            >
              Back to Home
            </Link>
          }
        />
        <p className="text-muted-foreground">
          {model.routine.archived_at ? "Archived routine · " : ""}Completed and
          skipped occurrences
        </p>
        <ul role="list" className="divide-y divide-border">
          {model.occurrences.map((occurrence) => (
            <li key={occurrence.id}>
              <Link
                className="flex min-h-14 items-center justify-between gap-3 py-3 no-underline"
                href={`/home/occurrences/${occurrence.id}`}
              >
                <p>{formatZurichDayLabel(occurrence.due_date)}</p>
                <p className="text-base text-muted-foreground sm:text-sm">
                  {occurrence.status === "completed" ? "Completed" : "Skipped"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        {!model.occurrences.length ? <p>No history on this page yet.</p> : null}
        <nav className="flex justify-between gap-3" aria-label="History pages">
          {page > 0 ? <Link href={`?page=${page - 1}`}>Newer</Link> : <span />}
          {model.hasMore ? <Link href={`?page=${page + 1}`}>Older</Link> : null}
        </nav>
      </div>
    </AppPage>
  );
}
