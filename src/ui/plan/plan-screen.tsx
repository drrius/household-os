import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { planDayHref } from "@/lib/ui/destinations";
import { cn } from "@/lib/utils";
import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";
import { MealBoard } from "@/ui/plan/meal-board";
import { PlanThisWeekJump } from "@/ui/plan/plan-this-week-jump.client";
import { PlanWeekArrow } from "@/ui/plan/plan-week-arrow.client";

type PlanScreenProps = {
  plan: PlanViewModel;
};

function MealLibrary({
  focusedDate,
  meals,
}: {
  focusedDate: string;
  meals: PlanViewModel["library"];
}) {
  return (
    <section aria-labelledby="meal-library-title">
      <Card>
        <CardHeader>
          <CardTitle>
            {/* CardTitle renders a div, so the region needs its own heading. */}
            <h2 id="meal-library-title">Meal library</h2>
          </CardTitle>
          <CardAction>
            <Badge variant="secondary">{meals.length} saved</Badge>
          </CardAction>
        </CardHeader>
        <CardContent>
          {meals.length === 0 ? (
            <EmptyState
              action={
                <Link
                  className={buttonVariants({ className: "no-underline" })}
                  href={`/plan/meals/new?date=${encodeURIComponent(focusedDate)}`}
                >
                  Add meal
                </Link>
              }
              title="No saved meals yet"
            >
              <p>Meals you save will appear here for quick reuse.</p>
            </EmptyState>
          ) : (
            <ul
              className="flex list-none gap-2 overflow-x-auto pb-1"
              aria-label="Saved meals"
            >
              {meals.map((meal) => (
                <li key={meal.id}>
                  <Link
                    className="no-underline"
                    href={`/plan/meals/new?date=${encodeURIComponent(focusedDate)}&libraryId=${encodeURIComponent(meal.id)}`}
                  >
                    <Badge variant="secondary">{meal.title}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  );
}

// Weeks near today read better by name than by date range.
function relativeWeekLabel(weekOffset: number): string | null {
  if (weekOffset === 0) return "This week";
  if (weekOffset === 1) return "Next week";
  if (weekOffset === -1) return "Last week";
  return null;
}

export function PlanScreen({ plan }: PlanScreenProps) {
  const viewingCurrentWeek = plan.weekOffset === 0;
  const weekLabel = relativeWeekLabel(plan.weekOffset);
  const previousWeek = {
    href: planDayHref(plan.previousWeek.date),
    rangeLabel: plan.previousWeek.rangeLabel,
  };
  const nextWeek = {
    href: planDayHref(plan.nextWeek.date),
    rangeLabel: plan.nextWeek.rangeLabel,
  };

  return (
    <AppPage labelledBy="plan-title">
      <PageHeader
        eyebrow={
          weekLabel === null
            ? plan.timeZoneLabel
            : `${weekLabel} · ${plan.timeZoneLabel}`
        }
        titleId="plan-title"
        title={plan.rangeLabel}
        trailing={
          <div className="flex items-center gap-2">
            <PlanThisWeekJump visible={!viewingCurrentWeek} />
            <PlanWeekArrow direction="previous" {...previousWeek} />
            <PlanWeekArrow direction="next" {...nextWeek} />
            <Link
              className={cn(
                buttonVariants(),
                "hidden no-underline md:inline-flex",
              )}
              href={`/plan/meals/new?date=${plan.focusedDate}&slot=dinner`}
            >
              Add meal
            </Link>
          </div>
        }
      />
      <MealBoard days={plan.days} nextWeek={nextWeek} />
      <MealLibrary focusedDate={plan.focusedDate} meals={plan.library} />
    </AppPage>
  );
}
