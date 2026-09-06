import Link from "next/link";

import { CalendarDays, FolderCheck, Plane } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { addCivilDays, startOfZurichWeek } from "@/lib/ui/zurich-date";
import { cn } from "@/lib/utils";
import { AppPage } from "@/ui/layout/app-page";
import { MealLibraryList } from "@/ui/plan/meal-library-list.client";
import { PageHeader } from "@/ui/layout/page-header";
import { MealBoard } from "@/ui/plan/meal-board";
import { PlanThisWeekJump } from "@/ui/plan/plan-this-week-jump.client";
import { PlanWeekArrow } from "@/ui/plan/plan-week-arrow.client";
import { PlanWeekUnavailable } from "@/ui/plan/plan-week-unavailable.client";

type PlanScreenProps = {
  plan: PlanViewModel;
  selectedDay?: string;
};

export function PlanScreen({ plan, selectedDay }: PlanScreenProps) {
  const previousWeek = addCivilDays(plan.weekStart, -7);
  const nextWeek = addCivilDays(plan.weekStart, 7);
  const currentWeekStart = startOfZurichWeek(plan.today);
  const viewingCurrentWeek = plan.weekStart === currentWeekStart;

  const planningDate = plan.days.some((day) => day.date === selectedDay)
    ? selectedDay!
    : viewingCurrentWeek
      ? plan.today
      : plan.weekStart;

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
              href={`/plan/meals/new?date=${planningDate}&slot=dinner`}
            >
              Add meal
            </Link>
          </div>
        }
      />
      <PlanDestinations />
      <PlanWeekStatus week={plan.week} />
      <MealBoard days={plan.days} selectedDay={selectedDay} />
      <PlanCollections plan={plan} planningDate={planningDate} />
    </AppPage>
  );
}

const destinations = [
  { href: "/plan/calendar", label: "Our calendar", Icon: CalendarDays },
  { href: "/plan/trips", label: "Trips", Icon: Plane },
  { href: "/plan/projects", label: "Projects", Icon: FolderCheck },
] as const;

function PlanDestinations() {
  return (
    <nav aria-label="Plan sections" className="flex flex-wrap gap-2">
      {destinations.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className={cn(
            buttonVariants({ variant: "secondary" }),
            "h-11 gap-2 px-4 no-underline shadow-sm ring-1 ring-foreground/5",
          )}
        >
          <Icon aria-hidden="true" className="size-4" />
          {label}
        </Link>
      ))}
    </nav>
  );
}

function PlanWeekStatus({ week }: { week: PlanViewModel["week"] }) {
  if (week.status === "unavailable") return <PlanWeekUnavailable />;
  if (week.warnings.length === 0 && week.syncAttention === 0) return null;
  return (
    <p role="status" className="text-sm text-muted-foreground">
      {week.warnings.length > 0
        ? "Some calendar events could not be displayed. "
        : "Some calendar changes need sync or attention. "}
      <Link href="/plan/calendar">Review calendar</Link>
    </p>
  );
}

type PlanCollectionsProps = { plan: PlanViewModel; planningDate: string };

function PlanCollections({ plan, planningDate }: PlanCollectionsProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section
        aria-labelledby="meal-ideas-title"
        className="grid content-start gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="meal-ideas-title"
            className="font-heading text-xl font-semibold"
          >
            Ideas for this week
          </h2>
          <Link
            className={buttonVariants({
              variant: "outline",
              className: "no-underline",
            })}
            href={`/plan/meals/new?date=${plan.weekStart}&slot=idea`}
          >
            Add an idea
          </Link>
        </div>
        {plan.ideas?.length ? (
          <ul role="list" className="grid list-none gap-3">
            {plan.ideas.map((idea) => (
              <li key={idea.id}>
                <Link className="no-underline" href={`/plan/meals/${idea.id}`}>
                  <Card size="sm">
                    <CardContent>
                      <h3 className="font-medium">{idea.title}</h3>
                      {idea.notes ? (
                        <p className="line-clamp-2 text-base text-muted-foreground sm:text-sm">
                          {idea.notes}
                        </p>
                      ) : null}
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base text-muted-foreground sm:text-sm">
            Something sounds good, but you haven’t picked a day? Keep it here.
          </p>
        )}
      </section>
      <section
        aria-labelledby="meal-library-title"
        className="grid content-start gap-4"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2
            id="meal-library-title"
            className="font-heading text-xl font-semibold"
          >
            Meal library
          </h2>
          <Link
            className={buttonVariants({
              variant: "outline",
              className: "no-underline",
            })}
            href={`/plan/library/new?date=${planningDate}`}
          >
            Save a meal
          </Link>
        </div>
        <MealLibraryList meals={plan.library} date={planningDate} />
        <ArchivedMealsLink date={planningDate} />
      </section>
    </div>
  );
}

function ArchivedMealsLink({ date }: { date: string }) {
  return (
    <Link
      className="min-h-11 w-fit content-center text-sm text-muted-foreground underline"
      href={`/plan/library/archived?date=${date}`}
    >
      Archived meals
    </Link>
  );
}
