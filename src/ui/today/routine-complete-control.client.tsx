"use client";

import { Check } from "lucide-react";
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
      <div className="flex min-w-0 items-start gap-2">
        <span
          className="flex h-lh w-4 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {isCompleted ? (
            <Check className="size-4 shrink-0 stroke-success" />
          ) : null}
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
          <small className="text-sm text-muted-foreground">{row.meta}</small>
        </span>
      </div>
      {row.canComplete && !isCompleted ? (
        <form action={completeAction}>
          <Button type="submit" variant="outline">
            Mark done
          </Button>
        </form>
      ) : (
        <Badge variant="success">Done</Badge>
      )}
    </div>
  );
}
