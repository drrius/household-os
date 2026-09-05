import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { mealPlanHref } from "@/lib/forms/meal-navigation";
import type { ManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export function RemovedMealDetails({
  entry,
  day,
}: {
  entry: ManageMealEntry;
  day: string;
}) {
  return (
    <AppPage labelledBy="removed-meal-title">
      <div className="grid max-w-3xl gap-6">
        <Link
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
          href={mealPlanHref(day)}
        >
          Back to plan
        </Link>
        <PageHeader
          titleId="removed-meal-title"
          title={entry.title}
          eyebrow="Removed from the plan"
        />
        <p className="text-muted-foreground">
          Originally planned for {formatZurichDayLabel(entry.date)}
          {entry.slot ? ` · ${entry.slot}` : ""}. The recipe and notes remain
          available for leftovers and reference.
        </p>
        {entry.notes ? (
          <p className="whitespace-pre-wrap wrap-anywhere">{entry.notes}</p>
        ) : null}
        {entry.recipeUrl && /^https?:\/\//i.test(entry.recipeUrl) ? (
          <Link
            className={buttonVariants({ className: "w-fit" })}
            href={entry.recipeUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open recipe ↗
          </Link>
        ) : null}
        {entry.libraryId ? (
          <Link
            className="min-h-11 w-fit content-center underline"
            href={`/plan/library/${entry.libraryId}?date=${entry.date}`}
          >
            View saved meal
          </Link>
        ) : null}
      </div>
    </AppPage>
  );
}
