import { Plus } from "lucide-react";
import Link from "next/link";

import type { PlanViewModel } from "@/lib/read-models/plan";
import { cn } from "@/lib/utils";

type PlanDay = PlanViewModel["days"][number];
type PlanSlot = PlanDay["slots"][number];
type MealEntry = NonNullable<PlanSlot["entry"]>;

type EmptyMealTileProps = {
  date: string;
  dateLabel: string;
  slot: PlanSlot["slot"];
};

export function EmptyMealTile({ date, dateLabel, slot }: EmptyMealTileProps) {
  return (
    <Link
      aria-label={`Add ${slot} on ${dateLabel}`}
      // Empty slots outnumber meals in a normal week, so they stay quieter than
      // the board itself and only firm up on hover.
      className="flex h-full items-center justify-center gap-1.5 rounded-xl bg-muted/40 p-3 font-heading text-base font-semibold text-muted-foreground no-underline hover:bg-muted hover:text-foreground lg:text-sm"
      href={`/plan/meals/new?date=${encodeURIComponent(date)}&slot=${encodeURIComponent(slot)}`}
    >
      <Plus aria-hidden="true" className="size-4 shrink-0" />
      {/* The rail names every row above lg, so the word would repeat 7 times. */}
      <span className="truncate capitalize lg:hidden">{slot}</span>
    </Link>
  );
}

type FilledMealTileProps = {
  dateLabel: string;
  entry: MealEntry;
  slot: PlanSlot["slot"];
};

export function FilledMealTile({
  dateLabel,
  entry,
  slot,
}: FilledMealTileProps) {
  return (
    <Link
      aria-label={`${slot} on ${dateLabel}: ${entry.title}`}
      className={cn(
        "grid h-full min-w-0 content-start gap-1 rounded-xl p-3 no-underline",
        entry.isLeftover ? "bg-warning-soft" : "bg-secondary",
      )}
      href={`/plan/meals/${entry.id}`}
    >
      <p
        className={cn(
          "truncate text-sm capitalize lg:text-xs",
          entry.isLeftover
            ? "font-medium text-warning-foreground"
            : // Leftovers keep their caption; the rail covers the plain slots.
              "text-muted-foreground lg:hidden",
        )}
      >
        {entry.isLeftover ? "Leftover" : slot}
      </p>
      <h4 className="wrap-anywhere text-base font-semibold lg:text-sm">
        {entry.title}
      </h4>
      {/* Notes hold up to 4000 characters of free text, so every line breaks
          inside words: an unbroken token would otherwise widen the carousel. */}
      {entry.notes !== null ? (
        <p className="wrap-anywhere text-sm text-muted-foreground lg:text-xs">
          {entry.notes}
        </p>
      ) : null}
      {entry.cookLabel !== null ? (
        <p className="wrap-anywhere font-heading text-sm font-semibold lg:text-xs">
          {entry.cookLabel}
        </p>
      ) : null}
    </Link>
  );
}
