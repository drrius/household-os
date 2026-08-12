"use client";

import { useOptimistic } from "react";

import { completeRoutineOccurrence } from "@/app/(product)/_actions/routines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoutineRow } from "@/ui/today/today-view-model";

type RoutineCompleteControlProps = {
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
    <div className="flex min-w-0 items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className="w-5 shrink-0 text-xl font-extrabold text-success"
          aria-hidden="true"
        >
          {isCompleted ? "✓" : ""}
        </span>
        <span className="grid min-w-0">
          <strong
            className={cn(
              "wrap-anywhere",
              isCompleted && "text-muted-foreground line-through",
            )}
          >
            {row.title}
          </strong>
          <small className="text-xs text-muted-foreground">{row.meta}</small>
        </span>
      </div>
      {row.canComplete && !isCompleted ? (
        <form action={completeAction}>
          <Button type="submit" variant="outline">
            Done
          </Button>
        </form>
      ) : (
        <Badge variant="success">Done</Badge>
      )}
    </div>
  );
}
