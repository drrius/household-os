import { Card, CardContent } from "@/components/ui/card";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { cn } from "@/lib/utils";
import { MealBoardSlotPresence } from "@/ui/plan/meal-board-presence.client";
import { EmptyMealTile, FilledMealTile } from "@/ui/plan/meal-board-tiles";
import { PlanWeekPager } from "@/ui/plan/plan-week-pager.client";

type PlanDay = PlanViewModel["days"][number];

// The pager scrolls columns into view by id, so the convention lives here.
function dayColumnId(date: string): string {
  return `plan-day-column-${date}`;
}

// The rail and every day column share one row template, which is what lines the
// three meal rows up across the week.
const slotRows =
  "grid-rows-[repeat(3,minmax(5.5rem,1fr))] lg:grid-rows-[repeat(3,minmax(6.5rem,1fr))]";
const slotRowLabels = ["Breakfast", "Lunch", "Dinner"] as const;

// Naming the rows once on the left lets every tile in the week drop its own
// caption. The tiles keep their own labels for screen readers.
function SlotRail() {
  return (
    <div
      aria-hidden="true"
      className="grid grid-rows-[auto_1fr] gap-2 pr-1 max-lg:hidden"
    >
      <div className="h-10" />
      <ul className={cn("grid list-none gap-2", slotRows)} role="list">
        {slotRowLabels.map((label) => (
          <li
            className="flex items-center justify-end text-sm text-muted-foreground"
            key={label}
          >
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function DayHeading({
  day,
  dateLabel,
  headingId,
}: {
  day: PlanDay;
  dateLabel: string;
  headingId: string;
}) {
  const [weekdayName, dayNumber] = day.weekdayLabel.split(" ");

  return (
    <header className="flex h-10 items-center justify-between gap-1 px-1.5">
      <h3 className="min-w-0" id={headingId}>
        <time
          className="flex items-baseline gap-1.5"
          dateTime={day.date}
          title={dateLabel}
        >
          <span
            className={cn(
              "truncate text-sm",
              day.isToday ? "text-primary" : "text-muted-foreground",
            )}
          >
            {weekdayName ?? day.weekdayLabel}
          </span>
          <span
            className={cn(
              "font-heading text-lg font-semibold tabular-nums",
              day.isToday && "text-primary",
            )}
          >
            {dayNumber ?? ""}
          </span>
        </time>
      </h3>
      {/* Columns are too narrow for the word above lg, where the tint carries it. */}
      {day.isToday ? (
        <p className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-sm font-medium text-primary-foreground lg:hidden">
          Today
        </p>
      ) : null}
    </header>
  );
}

function DayColumn({ day, dayIndex }: { day: PlanDay; dayIndex: number }) {
  const dateLabel = formatZurichDayLabel(day.date);
  const headingId = `plan-day-${day.date}`;

  return (
    <article
      aria-current={day.isToday ? "date" : undefined}
      aria-labelledby={headingId}
      id={dayColumnId(day.date)}
      className={cn(
        "grid min-w-0 snap-start grid-rows-[auto_1fr] gap-2 rounded-2xl p-1.5 lg:snap-none",
        day.isToday && "bg-primary/5 dark:bg-primary/10",
      )}
    >
      <DayHeading dateLabel={dateLabel} day={day} headingId={headingId} />
      <ul className={cn("grid list-none gap-2", slotRows)} role="list">
        {day.slots.map((mealSlot, slotIndex) => (
          <MealBoardSlotPresence
            index={dayIndex * day.slots.length + slotIndex}
            key={mealSlot.slot}
          >
            {mealSlot.entry === null ? (
              <EmptyMealTile
                date={day.date}
                dateLabel={dateLabel}
                slot={mealSlot.slot}
              />
            ) : (
              <FilledMealTile
                dateLabel={dateLabel}
                entry={mealSlot.entry}
                slot={mealSlot.slot}
              />
            )}
          </MealBoardSlotPresence>
        ))}
      </ul>
    </article>
  );
}

export function MealBoard({ days }: { days: PlanViewModel["days"] }) {
  return (
    <section aria-labelledby="meal-board-title">
      <h2 className="sr-only" id="meal-board-title">
        Monday to Sunday meal board
      </h2>
      <Card className="gap-0 py-0">
        <CardContent className="px-0">
          {/* A container, so the column width below lg is measured against the
              scroller instead of the viewport, which a scrollbar corrupts. */}
          <div className="@container snap-x snap-mandatory scroll-px-3 overflow-x-auto overscroll-x-contain p-3 lg:snap-none lg:overflow-x-visible">
            <div className="grid min-w-max auto-cols-[minmax(13rem,calc(100cqw-3.5rem))] grid-flow-col gap-2 lg:min-w-0 lg:auto-cols-auto lg:grid-flow-row lg:grid-cols-[auto_repeat(7,minmax(0,1fr))]">
              <SlotRail />
              {days.map((day, dayIndex) => (
                <DayColumn day={day} dayIndex={dayIndex} key={day.date} />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      <PlanWeekPager
        days={days.map((day) => ({
          columnId: dayColumnId(day.date),
          isToday: day.isToday,
          weekdayLabel: day.weekdayLabel,
        }))}
      />
    </section>
  );
}
