"use client";

import { useOptimistic } from "react";

import { completeRoutineOccurrence } from "@/app/(product)/_actions/routines";
import { Button } from "@/ui/primitives/button";
import { StatusPill } from "@/ui/primitives/status-pill";
import type { RoutineRow } from "@/ui/today/today-view-model";

export type RoutineCompleteControlProps = {
  row: RoutineRow;
};

export function RoutineCompleteControl({ row }: RoutineCompleteControlProps) {
  const [isCompleted, markCompleted] = useOptimistic(
    row.tone === "completed",
    () => true,
  );

  async function completeAction(): Promise<void> {
    markCompleted(true);
    await completeRoutineOccurrence(row.occurrenceId);
  }

  return (
    <div
      className={[
        "today-routine",
        isCompleted ? "today-routine--completed" : undefined,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="today-routine__copy">
        <span className="today-routine__check" aria-hidden="true">
          {isCompleted ? "✓" : ""}
        </span>
        <span>
          <strong>{row.title}</strong>
          <small>{row.meta}</small>
        </span>
      </div>
      {row.canComplete && !isCompleted ? (
        <form action={completeAction}>
          <Button type="submit" variant="secondary">
            Done
          </Button>
        </form>
      ) : (
        <StatusPill tone="success">Done</StatusPill>
      )}
    </div>
  );
}
