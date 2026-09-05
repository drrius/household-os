import Link from "next/link";
import { occursOnDay } from "@/domain/calendar/interval";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { AgendaItem, AgendaModel } from "@/lib/calendar/agenda";
import { syncCalendarAction } from "@/lib/calendar/actions";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { CalendarActionButton } from "./action-button.client";
function EventCard({ item }: { item: AgendaItem }) {
  const time = item.allDay
    ? "All day"
    : new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Zurich",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(item.startsAt));
  return (
    <Link
      href={`/plan/calendar/${item.id}${item.recurring ? `?occurrence=${encodeURIComponent(item.recurrenceId)}` : ""}`}
      className="group flex min-h-20 gap-4 rounded-2xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-primary"
    >
      <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
        {time}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium break-words">{item.title}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {item.attendance === "both"
            ? "Together"
            : item.attendance === "one"
              ? (item.attendeeName ?? "One of us")
              : "For awareness"}
          {item.location ? ` · ${item.location}` : ""}
        </p>
        {item.syncState === "pending" || item.syncState === "conflict" ? (
          <span className="mt-2 inline-block rounded-full bg-secondary px-2 py-1 text-xs">
            {item.syncState === "pending"
              ? "Waiting for iCloud sync"
              : "Versions need attention"}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
export function AgendaScreen({ model }: { model: AgendaModel }) {
  const { week } = model;
  const title = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(week.start));
  return (
    <AppPage labelledBy="calendar-title">
      <div className="@container flex w-full max-w-5xl flex-col gap-6">
        <PageHeader
          titleId="calendar-title"
          title="Our calendar"
          trailing={
            <Link href="/plan/calendar/new" className={buttonVariants()}>
              <Plus aria-hidden size={18} /> Add event
            </Link>
          }
        />
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Time together, time apart, and everything coming up. Times in
            Zurich.
          </p>
          <Link
            href="/home/calendar"
            className="text-sm underline underline-offset-4"
          >
            {model.connection ? "iCloud settings" : "Connect iCloud"}
          </Link>
        </div>
        <WeekNavigation week={week} title={title} />
        <AgendaSyncStatus model={model} />
        <AgendaDays model={model} />
        <CancelledPlans items={model.cancelled ?? []} />{" "}
        {model.warnings.map((warning) => (
          <p
            key={warning.id}
            className="rounded-xl border border-destructive p-4 text-sm"
          >
            <Link
              href={`/plan/calendar/${warning.id}`}
              className="font-medium underline"
            >
              {warning.title}
            </Link>
            : {warning.message}
          </p>
        ))}
      </div>
    </AppPage>
  );
}

function AgendaSyncStatus({ model }: { model: AgendaModel }) {
  return (
    <>
      {" "}
      {model.connection?.selected_calendar_url ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-secondary p-4">
          <p className="text-sm">
            {model.connection.calendar_name} ·{" "}
            {model.connection.last_synced_at
              ? `Last synced ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Zurich" }).format(new Date(model.connection.last_synced_at))}`
              : "Ready for first sync"}
          </p>
          <CalendarActionButton
            action={syncCalendarAction}
            label="Sync iCloud"
            pendingLabel="Syncing…"
            successLabel="Calendar is up to date."
          />
          {model.connection.last_error ? (
            <p className="w-full text-sm text-destructive">
              {model.connection.last_error}
            </p>
          ) : null}
        </div>
      ) : null}
      {model.attention.length > 0 ? (
        <details className="rounded-2xl border p-4">
          <summary className="min-h-11 cursor-pointer font-medium">
            {model.attention.length} event
            {model.attention.length === 1 ? "" : "s"} waiting for iCloud
          </summary>
          <ul className="grid gap-3">
            {model.attention.map((item) => (
              <li key={item.id}>
                <Link
                  className="underline underline-offset-4"
                  href={`/plan/calendar/${item.id}`}
                >
                  {item.title}
                </Link>
                <p className="text-sm text-muted-foreground">
                  {item.error ??
                    (item.state === "conflict"
                      ? "Choose which version to keep."
                      : "Sync to send this change.")}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}

function AgendaDays({ model }: { model: AgendaModel }) {
  return (
    <>
      {" "}
      <div className="grid gap-6 @3xl:grid-cols-2">
        {model.week.days.map((day) => {
          const items = model.items.filter((item) => occursOnDay(item, day));
          return (
            <section key={day} className="grid content-start gap-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">
                  {new Intl.DateTimeFormat("en-GB", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  }).format(new Date(day))}
                </h2>
                <Link
                  aria-label={`Add event on ${day}`}
                  href={`/plan/calendar/new?date=${day}`}
                  className={buttonVariants({
                    variant: "ghost",
                    size: "icon",
                  })}
                >
                  <Plus size={16} aria-hidden />
                </Link>
              </div>
              {items.length ? (
                items.map((item) => (
                  <EventCard
                    key={`${item.id}-${item.recurrenceId}`}
                    item={item}
                  />
                ))
              ) : (
                <div className="flex min-h-20 items-center gap-3 rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  <CalendarDays aria-hidden size={18} />
                  Room for something good.
                </div>
              )}
            </section>
          );
        })}
      </div>
    </>
  );
}

function WeekNavigation({
  week,
  title,
}: {
  week: AgendaModel["week"];
  title: string;
}) {
  return (
    <>
      {" "}
      <nav
        aria-label="Calendar week"
        className="flex items-center justify-between gap-2"
      >
        <Link
          href={`/plan/calendar?week=${week.previous}`}
          aria-label="Previous week"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronLeft aria-hidden />
        </Link>
        <div className="text-center">
          <h2 className="font-medium">{title}</h2>
          <Link
            className="text-sm text-muted-foreground underline underline-offset-4"
            href="/plan/calendar"
          >
            This week
          </Link>
        </div>
        <Link
          href={`/plan/calendar?week=${week.next}`}
          aria-label="Next week"
          className={buttonVariants({ variant: "outline", size: "icon" })}
        >
          <ChevronRight aria-hidden />
        </Link>
      </nav>
    </>
  );
}

function CancelledPlans({ items }: { items: { id: string; title: string }[] }) {
  if (!items.length) return null;
  return (
    <details className="rounded-2xl border p-4">
      <summary className="min-h-11 cursor-pointer text-sm font-medium">
        Recently cancelled plans
      </summary>
      <ul className="grid gap-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link
              className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
              href={`/plan/calendar/${item.id}`}
            >
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
