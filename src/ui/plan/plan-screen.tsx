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
import { addCivilDays, startOfZurichWeek } from "@/lib/ui/zurich-date";
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

function MealLibrary({ meals }: { meals: PlanViewModel["library"] }) {
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
                  href="/plan/meals/new"
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
                    href={`/plan/meals/new?libraryId=${encodeURIComponent(meal.id)}`}
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

export function PlanScreen({ plan }: PlanScreenProps) {
  const previousWeek = addCivilDays(plan.weekStart, -7);
  const nextWeek = addCivilDays(plan.weekStart, 7);
  const currentWeekStart = startOfZurichWeek(plan.today);
  const viewingCurrentWeek = plan.weekStart === currentWeekStart;

  return (
    <AppPage labelledBy="plan-title">
      <PageHeader
        eyebrow={
          viewingCurrentWeek
            ? `This week · ${plan.timeZoneLabel}`
            : plan.timeZoneLabel
        }
        titleId="plan-title"
        title={plan.rangeLabel}
        trailing={
          <div className="flex items-center gap-2">
            <PlanThisWeekJump visible={!viewingCurrentWeek} />
            <PlanWeekArrow
              direction="previous"
              href={`/plan?week=${previousWeek}`}
            />
            <PlanWeekArrow direction="next" href={`/plan?week=${nextWeek}`} />
            <Link
              className={cn(
                buttonVariants(),
                "hidden no-underline md:inline-flex",
              )}
              href={`/plan/meals/new?date=${plan.weekStart}&slot=dinner`}
            >
              Add meal
            </Link>
          </div>
        }
      />
      <Link
        href="/plan/calendar"
        className="flex min-h-16 items-center justify-between gap-4 rounded-2xl border bg-card p-4 no-underline hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span>
          <strong className="block">Our calendar</strong>
          <span className="text-sm text-muted-foreground">
            Shared plans, appointments and iCloud sync
          </span>
        </span>
        <span aria-hidden>→</span>
      </Link>
      <MealBoard days={plan.days} />
      <MealLibrary meals={plan.library} />
    </AppPage>
  );
}
