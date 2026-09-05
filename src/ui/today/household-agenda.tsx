import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { HouseholdAgendaEntry } from "@/domain/today/agenda-types";
import type { HouseholdAgendaModel } from "@/lib/read-models/household-agenda";
import { formatCivilDateShort } from "@/lib/ui/zurich-date";
import { PageSection } from "@/ui/layout/page-section";

function AgendaRows({
  entries,
  today,
}: {
  entries: HouseholdAgendaEntry[];
  today: string;
}) {
  return (
    <ul className="divide-y rounded-2xl border bg-card">
      {entries.map((entry) => (
        <li key={entry.id} className="px-4 py-1">
          <Link
            href={entry.href}
            className="flex min-h-16 items-center gap-4 py-3 no-underline"
          >
            <span className="w-20 shrink-0 text-sm tabular-nums text-muted-foreground">
              {entry.day < today
                ? `Overdue · ${formatCivilDateShort(entry.day)}`
                : entry.day === today
                  ? entry.ongoing
                    ? "In progress"
                    : (entry.time ?? "Today")
                  : formatCivilDateShort(entry.day)}
              {entry.day > today && entry.time ? (
                <span className="block">{entry.time}</span>
              ) : null}
            </span>
            <span className="min-w-0">
              <span className="block font-medium break-words">
                {entry.title}
              </span>
              <span className="mt-1 block text-sm break-words text-muted-foreground">
                {entry.detail}
              </span>
            </span>
          </Link>
          {entry.related ? (
            <Link
              href={entry.related.href}
              className="mb-2 inline-flex min-h-11 items-center text-sm"
            >
              {entry.related.label}
            </Link>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function HouseholdAgenda({ model }: { model: HouseholdAgendaModel }) {
  const due = model.entries.filter((entry) => entry.day <= model.today);
  const upcoming = model.entries.filter((entry) => entry.day > model.today);
  return (
    <PageSection
      title="Our plans & deadlines"
      titleId="today-agenda-title"
      action={
        <Link
          href="/plan/calendar"
          className="inline-flex min-h-11 items-center text-sm"
        >
          Calendar
        </Link>
      }
    >
      <p className="text-sm text-muted-foreground">
        Today and the next six days · times in Zurich
      </p>
      {due.length ? (
        <AgendaRows entries={due} today={model.today} />
      ) : (
        <p className="text-sm text-muted-foreground">
          No other plans or deadlines today.
        </p>
      )}
      {upcoming.length ? (
        <details className="group">
          <summary className="flex min-h-11 cursor-pointer items-center gap-2 font-medium">
            Coming up · {upcoming.length}
            <ChevronDown
              aria-hidden="true"
              className="size-4 transition-transform group-open:rotate-180 motion-reduce:transition-none"
            />
          </summary>
          <AgendaRows entries={upcoming} today={model.today} />
        </details>
      ) : null}
      {model.warnings.length ? (
        <p role="status" className="text-sm">
          Some calendar events could not be displayed.{" "}
          <Link href="/plan/calendar">Review calendar warnings</Link> before
          relying on this agenda.
        </p>
      ) : null}
      {model.syncAttention ? (
        <p className="text-sm text-muted-foreground">
          Some calendar changes need sync or attention.{" "}
          <Link href="/plan/calendar">Review calendar</Link>
        </p>
      ) : null}
    </PageSection>
  );
}
