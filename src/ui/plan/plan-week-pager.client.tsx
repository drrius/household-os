"use client";

import { useEffect, useState } from "react";

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

function findBoardScroller(columnId: string): Element | null {
  return document.getElementById(columnId)?.closest(".overflow-x-auto") ?? null;
}

function useVisibleDayColumn(
  columnIdsKey: string,
  onVisible: (columnId: string) => void,
): void {
  useEffect(() => {
    const columnIds = columnIdsKey === "" ? [] : columnIdsKey.split("\0");
    if (columnIds.length === 0) return;
    if (window.matchMedia(BOARD_IS_A_GRID).matches) return;

    const scroller = findBoardScroller(columnIds[0]!);
    if (scroller === null) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          ratios.set(entry.target.id, entry.intersectionRatio);
        }
        let bestId: string | null = null;
        let bestRatio = 0;
        for (const [id, ratio] of ratios) {
          if (ratio > bestRatio) {
            bestId = id;
            bestRatio = ratio;
          }
        }
        if (bestId !== null && bestRatio >= 0.5) {
          onVisible(bestId);
        }
      },
      { root: scroller, threshold: [0.5, 0.6, 0.75, 1] },
    );

    for (const columnId of columnIds) {
      const column = document.getElementById(columnId);
      if (column !== null) observer.observe(column);
    }

    return () => observer.disconnect();
  }, [columnIdsKey, onVisible]);
}

function DayPagerButton({
  day,
  isSelected,
  onSelect,
}: {
  day: PagerDay;
  isSelected: boolean;
  onSelect: (columnId: string) => void;
}) {
  return (
    <button
      aria-current={day.isToday ? "date" : undefined}
      aria-pressed={isSelected}
      className={cn(
        "relative flex h-11 min-w-0 flex-1 flex-col items-center justify-center overflow-hidden rounded-2xl px-1 font-heading text-xs leading-tight font-bold tabular-nums transition-colors motion-reduce:transition-none",
        day.isToday
          ? "bg-secondary text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        isSelected &&
          "text-foreground after:absolute after:inset-x-2 after:bottom-1.5 after:h-0.5 after:rounded-full after:bg-foreground",
        isSelected && day.isToday && "text-primary after:bg-primary",
      )}
      onClick={() => {
        onSelect(day.columnId);
        scrollToColumn(day.columnId, preferredBehavior());
      }}
      type="button"
    >
      {day.weekdayLabel}
    </button>
  );
}

export function PlanWeekPager({ days }: { days: PagerDay[] }) {
  const todayColumnId = days.find((day) => day.isToday)?.columnId ?? null;
  const fallbackColumnId = todayColumnId ?? days[0]?.columnId ?? null;
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    fallbackColumnId,
  );
  const [scrolledWeekId, setScrolledWeekId] = useState(todayColumnId);
  const columnIdsKey = days.map((day) => day.columnId).join("\0");

  if (todayColumnId !== scrolledWeekId) {
    setScrolledWeekId(todayColumnId);
    setSelectedColumnId(fallbackColumnId);
  }

  useEffect(() => {
    // The carousel rests on Monday, so the member's own day can sit two swipes
    // away and out of sight. This re-runs only when the week itself changes, so
    // it never fights a scroll the member started.
    if (todayColumnId === null) return;
    if (window.matchMedia(BOARD_IS_A_GRID).matches) return;
    scrollToColumn(todayColumnId, "auto");
  }, [todayColumnId]);

  useVisibleDayColumn(columnIdsKey, setSelectedColumnId);

  return (
    <div
      aria-label="Jump to a day"
      className="mt-3 flex w-full gap-1 lg:hidden"
      role="group"
    >
      {days.map((day) => (
        <DayPagerButton
          day={day}
          isSelected={day.columnId === selectedColumnId}
          key={day.columnId}
          onSelect={setSelectedColumnId}
        />
      ))}
    </div>
  );
}
