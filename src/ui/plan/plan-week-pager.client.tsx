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

function findBoardScroller(columnId: string): HTMLElement | null {
  const column = document.getElementById(columnId);
  return column?.closest<HTMLElement>(".overflow-x-auto") ?? null;
}

function scrollToColumn(columnId: string): void {
  // `block: "nearest"` keeps the page's own vertical scroll where it was.
  document
    .getElementById(columnId)
    ?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "start" });
}

function columnNearestScrollStart(columnIds: string[]): string | null {
  const scroller = findBoardScroller(columnIds[0]!);
  if (scroller === null) return null;

  const startEdge = scroller.getBoundingClientRect().left;
  let nearestId: string | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const columnId of columnIds) {
    const column = document.getElementById(columnId);
    if (column === null) continue;
    const distance = Math.abs(column.getBoundingClientRect().left - startEdge);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestId = columnId;
    }
  }
  return nearestId;
}

function useSelectionFollowsScroll(
  columnIdsKey: string,
  setSelectedColumnId: (columnId: string) => void,
): void {
  useEffect(() => {
    const columnIds = columnIdsKey === "" ? [] : columnIdsKey.split("\0");
    if (columnIds.length === 0) return;
    if (window.matchMedia(BOARD_IS_A_GRID).matches) return;

    const scroller = findBoardScroller(columnIds[0]!);
    if (scroller === null) return;

    let frame = 0;
    const sync = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nearest = columnNearestScrollStart(columnIds);
        if (nearest !== null) setSelectedColumnId(nearest);
      });
    };

    scroller.addEventListener("scroll", sync, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener("scroll", sync);
    };
  }, [columnIdsKey, setSelectedColumnId]);
}

function dayButtonClass(isSelected: boolean, isToday: boolean): string {
  if (isSelected) return "bg-secondary text-primary";
  if (isToday) return "text-primary hover:bg-muted";
  return "text-muted-foreground hover:bg-muted hover:text-foreground";
}

export function PlanWeekPager({ days }: { days: PagerDay[] }) {
  const todayColumnId = days.find((day) => day.isToday)?.columnId ?? null;
  const fallbackColumnId = todayColumnId ?? days[0]?.columnId ?? null;
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(
    fallbackColumnId,
  );
  const [renderedWeekId, setRenderedWeekId] = useState(fallbackColumnId);
  const columnIdsKey = days.map((day) => day.columnId).join("\0");

  if (fallbackColumnId !== renderedWeekId) {
    setRenderedWeekId(fallbackColumnId);
    setSelectedColumnId(fallbackColumnId);
  }

  useEffect(() => {
    // The carousel rests on Monday, so the member's own day can sit two swipes
    // away and out of sight. This re-runs only when the week itself changes, so
    // it never fights a scroll the member started.
    if (todayColumnId === null) return;
    if (window.matchMedia(BOARD_IS_A_GRID).matches) return;
    scrollToColumn(todayColumnId);
  }, [todayColumnId]);

  useSelectionFollowsScroll(columnIdsKey, setSelectedColumnId);

  return (
    <div
      aria-label="Jump to a day"
      className="mt-3 flex w-full gap-1 lg:hidden"
      role="group"
    >
      {days.map((day) => {
        const isSelected = day.columnId === selectedColumnId;
        return (
          <button
            aria-current={day.isToday ? "date" : undefined}
            aria-pressed={isSelected}
            className={cn(
              "flex h-11 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-2xl px-1 font-heading text-xs leading-tight font-bold tabular-nums transition-colors motion-reduce:transition-none",
              dayButtonClass(isSelected, day.isToday),
            )}
            key={day.columnId}
            onClick={() => {
              setSelectedColumnId(day.columnId);
              scrollToColumn(day.columnId);
            }}
            type="button"
          >
            {day.weekdayLabel}
          </button>
        );
      })}
    </div>
  );
}
