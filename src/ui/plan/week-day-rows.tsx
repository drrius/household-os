import {
  BellRing,
  CalendarDays,
  FolderCheck,
  ListChecks,
  Plane,
  Plus,
  Ticket,
} from "lucide-react";
import Link from "next/link";

import type { WeekPlanEntry, WeekRoutine } from "@/domain/plan/week-types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { RoutineCompleteControl } from "@/ui/today/routine-complete-control.client";

const kindIcon: Record<WeekPlanEntry["kind"], typeof CalendarDays> = {
  calendar: CalendarDays,
  booking: Ticket,
  trip: Plane,
  task: ListChecks,
  project: FolderCheck,
  commitment: BellRing,
};

const kindLabel: Record<WeekPlanEntry["kind"], string> = {
  calendar: "All day",
  booking: "Booking",
  trip: "Trip starts",
  task: "Task due",
  project: "Target date",
  commitment: "Deadline",
};

function PlanEntry({ entry }: { entry: WeekPlanEntry }) {
  const Icon = kindIcon[entry.kind];
  const lead =
    entry.time ?? (entry.continues ? "Continues" : kindLabel[entry.kind]);
  return (
    <li className="min-w-0">
      <Link
        href={entry.href}
        className={cn(
          "grid min-h-11 content-center gap-0.5 rounded-xl px-2.5 py-2 no-underline transition-colors hover:bg-accent motion-reduce:transition-none",
          entry.continues ? "bg-secondary/60" : "bg-secondary",
        )}
      >
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground tabular-nums">
          <Icon aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{lead}</span>
        </span>
        <span className="text-sm leading-snug font-semibold wrap-anywhere">
          {entry.title}
        </span>
        <span className="line-clamp-2 text-xs text-muted-foreground wrap-anywhere">
          {entry.detail}
        </span>
      </Link>
      {entry.related ? (
        <Link
          href={entry.related.href}
          className="inline-flex min-h-11 items-center px-2.5 text-xs"
        >
          {entry.related.label}
        </Link>
      ) : null}
    </li>
  );
}

export function DayPlans({
  date,
  dateLabel,
  plans,
}: {
  date: string;
  dateLabel: string;
  plans: readonly WeekPlanEntry[];
}) {
  return (
    <section
      aria-label={`Plans on ${dateLabel}`}
      className="grid content-start gap-1.5"
    >
      <div className="flex h-8 items-center justify-between gap-2">
        <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Plans
        </h4>
        <Link
          aria-label={`Add event on ${dateLabel}`}
          href={`/plan/calendar/new?date=${encodeURIComponent(date)}`}
          className={cn(
            buttonVariants({ variant: "ghost", size: "icon-sm" }),
            "-mr-1 no-underline",
          )}
        >
          <Plus aria-hidden="true" className="size-4" />
        </Link>
      </div>
      {plans.length > 0 ? (
        <ul role="list" className="grid list-none gap-1.5">
          {plans.map((entry) => (
            <PlanEntry key={entry.id} entry={entry} />
          ))}
        </ul>
      ) : (
        <p className="px-0.5 text-xs text-muted-foreground">Nothing planned.</p>
      )}
    </section>
  );
}

export function DayRoutines({
  dateLabel,
  routines,
}: {
  dateLabel: string;
  routines: readonly WeekRoutine[];
}) {
  if (routines.length === 0) return null;
  return (
    <section
      aria-label={`Routines on ${dateLabel}`}
      className="grid content-start gap-1.5"
    >
      <h4 className="flex h-8 items-center text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Routines
      </h4>
      <ul role="list" className="grid list-none gap-2">
        {routines.map((row) => (
          <li key={row.occurrenceId} className="min-w-0">
            <RoutineCompleteControl row={row} />
          </li>
        ))}
      </ul>
    </section>
  );
}
