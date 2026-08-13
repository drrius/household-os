import { ChevronLeft, ChevronRight } from "lucide-react";
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
import { addCivilDays } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { AppPage } from "@/ui/layout/app-page";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageHeader } from "@/ui/layout/page-header";
import { MealBoard } from "@/ui/plan/meal-board";

type PlanScreenProps = {
  plan: PlanViewModel;
};

function MealLibrary({ meals }: { meals: PlanViewModel["library"] }) {
  return (
    <section aria-labelledby="meal-library-title">
      <Card>
        <CardHeader>
          <CardTitle id="meal-library-title">Meal library</CardTitle>
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
                    <Badge className="cursor-pointer" variant="secondary">
                      {meal.title}
                    </Badge>
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

  return (
    <AppPage labelledBy="plan-title">
      <PageHeader
        titleId="plan-title"
        title="This week"
        eyebrow={`${plan.rangeLabel} · ${plan.timeZoneLabel}`}
        trailing={
          <>
            <Link
              aria-label="Previous week"
              className={buttonVariants({
                className: "no-underline",
                size: "icon",
                variant: "outline",
              })}
              href={`/plan?week=${previousWeek}`}
            >
              <ChevronLeft aria-hidden="true" className="size-4 shrink-0" />
            </Link>
            <Link
              aria-label="Next week"
              className={buttonVariants({
                className: "no-underline",
                size: "icon",
                variant: "outline",
              })}
              href={`/plan?week=${nextWeek}`}
            >
              <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
            <Link
              className={buttonVariants({ className: "no-underline" })}
              href={`/plan/meals/new?date=${plan.weekStart}&slot=dinner`}
            >
              Add meal
            </Link>
          </>
        }
      />
      <MealBoard days={plan.days} />
      <MealLibrary meals={plan.library} />
    </AppPage>
  );
}
