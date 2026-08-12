import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { cn } from "@/lib/utils";

type PlanDay = PlanViewModel["days"][number];
type PlanSlot = PlanDay["slots"][number];

type MealSlotProps = {
  dateLabel: string;
  mealSlot: PlanSlot;
};

function MealSlot({ dateLabel, mealSlot }: MealSlotProps) {
  const { entry, slot } = mealSlot;

  if (entry === null) {
    return (
      <li className="min-w-0">
        <Link
          className="flex min-h-full items-center justify-center rounded-xl border border-dashed p-3 font-heading font-bold text-muted-foreground no-underline transition-colors hover:border-primary hover:bg-card hover:text-secondary-foreground motion-reduce:transition-none"
          href="/plan/meals/new"
          aria-label={`Add ${slot} on ${dateLabel}`}
        >
          + {slot}
        </Link>
      </li>
    );
  }

  return (
    <li className="min-w-0">
      <Card
        className={cn(
          "h-full",
          entry.isLeftover ? "bg-warning-soft" : "bg-secondary",
        )}
        size="sm"
      >
        <CardHeader className="flex-row flex-wrap items-start">
          <CardTitle className="text-xs text-muted-foreground capitalize">
            {slot}
          </CardTitle>
          <CardAction>
            {entry.isLeftover ? (
              <Badge variant="warning">Leftover</Badge>
            ) : null}
          </CardAction>
        </CardHeader>
        <CardContent className="grid min-w-0 gap-2">
          <h3 className="wrap-anywhere text-sm leading-snug font-semibold">
            {entry.title}
          </h3>
          {entry.notes !== null ? <p>{entry.notes}</p> : null}
          {entry.cookLabel !== null ? (
            <p className="font-heading font-bold">{entry.cookLabel}</p>
          ) : null}
        </CardContent>
      </Card>
    </li>
  );
}

function DayColumn({ day }: { day: PlanDay }) {
  const dateLabel = formatZurichDayLabel(day.date);

  return (
    <article
      className={cn(
        "grid min-w-0 snap-start border-2 border-transparent border-r-border p-3 last:border-r-transparent lg:snap-none lg:p-2",
        day.isToday && "border-primary bg-secondary last:border-primary",
      )}
      aria-labelledby={`plan-day-${day.date}`}
    >
      <header className="flex min-h-11 items-center justify-between gap-2">
        <h2 className="font-heading text-xl" id={`plan-day-${day.date}`}>
          <time dateTime={day.date} title={dateLabel}>
            {day.weekdayLabel}
          </time>
        </h2>
        {day.isToday ? <Badge variant="accent">Today</Badge> : null}
      </header>
      <ul className="grid list-none grid-rows-[repeat(3,minmax(7.5rem,auto))] gap-2">
        {day.slots.map((mealSlot) => (
          <MealSlot
            key={mealSlot.slot}
            dateLabel={dateLabel}
            mealSlot={mealSlot}
          />
        ))}
      </ul>
    </article>
  );
}

export function MealBoard({ days }: { days: PlanViewModel["days"] }) {
  return (
    <section aria-labelledby="meal-board-title">
      <h2 id="meal-board-title" className="sr-only">
        Monday to Sunday meal board
      </h2>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          <div className="snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-3 lg:snap-none lg:overflow-x-visible">
            <div className="grid min-w-max auto-cols-[minmax(15rem,82vw)] grid-flow-col lg:min-w-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-7">
              {days.map((day) => (
                <DayColumn key={day.date} day={day} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
