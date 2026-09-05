"use client";

import { Check, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";

import { completeRoutineOccurrence } from "@/app/(product)/_actions/routines";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RoutineRow } from "@/ui/today/today-view-model";

export function RoutineCompleteControl({ row }: { row: RoutineRow }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCompleted, markCompleted] = useOptimistic(
    row.tone === "completed",
    () => true,
  );
  function complete() {
    setError(null);
    startTransition(async () => {
      markCompleted(true);
      try {
        await completeRoutineOccurrence(row.occurrenceId);
      } catch {
        setError("That didn't save. Your routine is still here — try again.");
      }
    });
  }
  return (
    <div className="grid gap-2">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          aria-label={
            isCompleted ? `${row.title} completed` : `Mark ${row.title} done`
          }
          aria-busy={pending}
          className={cn(
            "size-11 rounded-full",
            isCompleted && "bg-success-soft text-success",
          )}
          disabled={pending || !row.canComplete || isCompleted}
          onClick={complete}
          size="icon"
          type="button"
          variant="outline"
        >
          {pending ? (
            <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <Check className="size-4" />
          )}
        </Button>
        <div className="min-w-0 flex-1">
          <Link
            className={cn(
              "grid min-h-11 content-center gap-1 rounded-md no-underline outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isCompleted && "text-muted-foreground",
            )}
            href={`/home/occurrences/${row.occurrenceId}`}
          >
            <p
              className={cn(
                "font-medium wrap-anywhere",
                isCompleted && "line-through",
              )}
            >
              {row.title}
            </p>
            <p
              className={cn(
                "text-base sm:text-sm",
                row.tone === "overdue" && !isCompleted
                  ? "text-destructive-strong"
                  : "text-muted-foreground",
              )}
            >
              {row.meta}
            </p>
          </Link>
        </div>
      </div>
      <div
        aria-live="polite"
        className="text-base text-destructive-strong sm:text-sm"
      >
        {error}
      </div>
    </div>
  );
}
