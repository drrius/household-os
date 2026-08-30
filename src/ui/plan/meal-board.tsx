import { ChevronRight, Plus } from "lucide-react";
import Link from "next/link";

import { Card, CardContent } from "@/components/ui/card";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { cn } from "@/lib/utils";
import { MealBoardSlotPresence } from "@/ui/plan/meal-board-presence.client";
import { PlanWeekPager } from "@/ui/plan/plan-week-pager.client";

type PlanDay = PlanViewModel["days"][number];
type PlanSlot = PlanDay["slots"][number];
type WeekStep = { href: string; rangeLabel: string };

// The pager scrolls columns into view by id, so the convention lives here.
function dayColumnId(date: string): string {
  return `plan-day-column-${date}`;
}

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
          <h4 className="wrap-anywhere text-sm leading-snug font-semibold">
            {entry.title}
          </h4>
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
      aria-current={day.isToday ? "date" : undefined}
      aria-labelledby={`plan-day-${day.date}`}
      id={dayColumnId(day.date)}
      className={cn(
        // Bordered on the left, so the trailing rail keeps its own separator
        // and the grid at lg still ends flush with the card.
        "relative grid min-w-0 snap-start grid-rows-[auto_1fr] border-l border-border p-3 first:border-l-0 lg:snap-none lg:p-2",
        day.isToday &&
          "before:pointer-events-none before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-full before:bg-primary lg:before:inset-x-2",
      )}
    >
      <header className="flex h-11 items-center justify-between gap-2">
        <h3
          className={cn(
            "min-w-0 truncate font-heading text-xl tabular-nums lg:text-base",
            day.isToday && "text-primary",
          )}
          id={`plan-day-${day.date}`}
        >
          <time dateTime={day.date} title={dateLabel}>
            {day.weekdayLabel}
          </time>
        </h3>
        {day.isToday ? (
          <p className="flex shrink-0 items-center gap-1.5 text-sm font-medium text-primary lg:text-xs">
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-primary"
            />
            Today
          </p>
        ) : null}
      </header>
      {/* Shorter rows below lg keep one whole day plus the pager inside 844px. */}
      <ul className="grid list-none grid-rows-[repeat(3,minmax(7.5rem,1fr))] gap-2 max-lg:grid-rows-[repeat(3,minmax(6rem,1fr))]">
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

// Below lg the board is a carousel, and Sunday used to be a dead end. This rail
// is the track the week ends on, so it fills the peek beside the last day
// instead of costing a swipe. The grid at lg steps weeks from the header.
function NextWeekRail({ href, rangeLabel }: WeekStep) {
  const label = `Next week, ${rangeLabel}`;

  return (
    <Link
      aria-label={label}
      className="flex flex-col items-center justify-center gap-1 border-l border-border px-1 text-center font-heading text-xs leading-tight font-bold text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-primary motion-reduce:transition-none lg:hidden"
      href={href}
      title={label}
    >
      <ChevronRight
        aria-hidden="true"
        className="size-4 shrink-0 text-primary"
      />
      <span aria-hidden="true">Next week</span>
    </Link>
  );
}

export function MealBoard({
  days,
  nextWeek,
}: {
  days: PlanViewModel["days"];
  nextWeek: WeekStep;
}) {
  return (
    <section aria-labelledby="meal-board-title">
      <h2 id="meal-board-title" className="sr-only">
        Monday to Sunday meal board
      </h2>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          {/* A container, so the column width below lg is measured against the
              scroller instead of the viewport, which a scrollbar corrupts. */}
          <div className="@container snap-x snap-mandatory overflow-x-auto overscroll-x-contain scroll-px-3 max-lg:px-3 lg:snap-none lg:overflow-x-visible">
            {/* The trailing track is the next-week rail, which the last day's
                peek would otherwise leave empty. */}
            <div className="grid min-w-max grid-flow-col grid-cols-[repeat(7,minmax(14rem,calc(100cqw-3.5rem)))_3.5rem] lg:min-w-0 lg:grid-flow-row lg:grid-cols-7">
              {days.map((day, dayIndex) => (
                <DayColumn day={day} dayIndex={dayIndex} key={day.date} />
              ))}
              <NextWeekRail {...nextWeek} />
            </div>
          </div>
        </CardContent>
      </Card>
      <PlanWeekPager
        days={days.map((day) => ({
          columnId: dayColumnId(day.date),
          isFocused: day.isFocused,
          isToday: day.isToday,
          weekdayLabel: day.weekdayLabel,
        }))}
      />
    </section>
  );
}
