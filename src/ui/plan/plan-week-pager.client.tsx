"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

type PagerDay = {
  columnId: string;
  isToday: boolean;
  weekdayLabel: string;
};

// The board is only a seven-column grid at lg; below that it is a carousel.
const BOARD_IS_A_GRID = "(min-width: 1024px)";

function scrollToColumn(columnId: string, behavior: ScrollBehavior): void {
  // `block: "nearest"` keeps the page's own vertical scroll where it was.
  document
    .getElementById(columnId)
    ?.scrollIntoView({ behavior, block: "nearest", inline: "start" });
}

function preferredBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export function PlanWeekPager({ days }: { days: PagerDay[] }) {
  const todayColumnId = days.find((day) => day.isToday)?.columnId ?? null;

  useEffect(() => {
    // The carousel rests on Monday, so the member's own day can sit two swipes
    // away and out of sight. This re-runs only when the week itself changes, so
    // it never fights a scroll the member started.
    if (todayColumnId === null) return;
    if (window.matchMedia(BOARD_IS_A_GRID).matches) return;
    scrollToColumn(todayColumnId, "auto");
  }, [todayColumnId]);

  return (
    <div
      aria-label="Jump to a day"
      className="mt-3 flex w-full gap-1 lg:hidden"
      role="group"
    >
      {days.map((day) => (
        <button
          aria-current={day.isToday ? "date" : undefined}
          className={cn(
            "flex h-11 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl px-1 font-heading text-xs leading-tight font-bold tabular-nums transition-colors motion-reduce:transition-none",
            day.isToday
              ? "bg-secondary text-primary"
              : "text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
          key={day.columnId}
          onClick={() => {
            scrollToColumn(day.columnId, preferredBehavior());
          }}
          type="button"
        >
          {day.weekdayLabel}
        </button>
      ))}
    </div>
  );
}
