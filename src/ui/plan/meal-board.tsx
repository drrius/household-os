import { Plus } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { cn } from "@/lib/utils";
import { MealBoardSlotPresence } from "@/ui/plan/meal-board-presence.client";

type PlanDay = PlanViewModel["days"][number];
type PlanSlot = PlanDay["slots"][number];

type MealSlotProps = {
  date: string;
  dateLabel: string;
  mealSlot: PlanSlot;
};

function MealSlot({ date, dateLabel, mealSlot }: MealSlotProps) {
  const { entry, slot } = mealSlot;

  if (entry === null) {
    return (
      <Link
        className="flex min-h-full items-center justify-center gap-1 rounded-xl border border-dashed p-3 font-heading font-bold text-muted-foreground no-underline transition-colors hover:border-primary hover:bg-card hover:text-secondary-foreground motion-reduce:transition-none"
        href={`/plan/meals/new?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slot)}`}
        aria-label={`Add ${slot} on ${dateLabel}`}
      >
        <Plus aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate capitalize">{slot}</span>
      </Link>
    );
  }

  return (
    <Link
      aria-label={`${slot} on ${dateLabel}: ${entry.title}`}
      className="block h-full no-underline"
      href={`/plan/meals/${entry.id}`}
    >
      <Card
        className={cn(
          "h-full",
          entry.isLeftover ? "bg-warning-soft" : "bg-secondary",
        )}
        size="sm"
      >
        <CardContent className="grid min-w-0 gap-2">
          <p
            className={cn(
              "truncate text-xs capitalize",
              entry.isLeftover
                ? "font-medium text-warning-foreground"
                : "text-muted-foreground",
            )}
          >
            {entry.isLeftover ? "Leftover" : slot}
          </p>
          <h3 className="wrap-anywhere text-sm leading-snug font-semibold">
            {entry.title}
          </h3>
          {entry.notes !== null ? <p>{entry.notes}</p> : null}
          {entry.cookLabel !== null ? (
            <p className="font-heading font-bold">{entry.cookLabel}</p>
          ) : null}
        </CardContent>
      </Card>
    </Link>
  );
}

function DayColumn({ day, dayIndex }: { day: PlanDay; dayIndex: number }) {
  const dateLabel = formatZurichDayLabel(day.date);

  return (
    <article
      className={cn(
        "grid min-w-0 snap-start grid-rows-[auto_1fr] border-2 border-transparent border-r-border p-3 last:border-r-transparent lg:snap-none lg:p-2",
        day.isToday && "border-primary bg-secondary last:border-primary",
      )}
      aria-labelledby={`plan-day-${day.date}`}
    >
      <header className="flex h-11 items-center justify-between gap-2">
        <h2
          className="min-w-0 truncate font-heading text-xl lg:text-base"
          id={`plan-day-${day.date}`}
        >
          <time dateTime={day.date} title={dateLabel}>
            {day.weekdayLabel}
          </time>
        </h2>
        {day.isToday ? <Badge variant="accent">Today</Badge> : null}
      </header>
      <ul className="grid list-none grid-rows-[repeat(3,minmax(7.5rem,1fr))] gap-2">
        {day.slots.map((mealSlot, slotIndex) => (
          <MealBoardSlotPresence
            index={dayIndex * day.slots.length + slotIndex}
            key={mealSlot.slot}
          >
            <MealSlot
              date={day.date}
              dateLabel={dateLabel}
              mealSlot={mealSlot}
            />
          </MealBoardSlotPresence>
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
              {days.map((day, dayIndex) => (
                <DayColumn day={day} dayIndex={dayIndex} key={day.date} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
