import Link from "next/link";
import { RemovedMealDetails } from "./removed-meal-details";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { mealPlanHref } from "@/lib/forms/meal-navigation";
import type { MealConnections } from "@/lib/meals/details";
import type { ManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { addCivilDays, formatZurichDayLabel } from "@/lib/ui/zurich-date";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

const secondary = buttonVariants({
  variant: "outline",
  className: "no-underline",
});

type MealDetailsProps = {
  entry: ManageMealEntry;
  connections: MealConnections;
  day: string;
};

function MealActions({ entry, day }: Pick<MealDetailsProps, "entry" | "day">) {
  const path = `/plan/meals/${entry.id}`;
  const safeRecipe =
    entry.recipeUrl && /^https?:\/\//i.test(entry.recipeUrl)
      ? entry.recipeUrl
      : null;
  return (
    <div className="flex flex-wrap gap-3">
      {safeRecipe ? (
        <Link
          className={buttonVariants({ className: "no-underline" })}
          href={safeRecipe}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open recipe ↗
        </Link>
      ) : null}
      <Link className={secondary} href={`${path}/move?day=${day}`}>
        {entry.slot === null ? "Choose a day" : "Move meal"}
      </Link>
      {!entry.isLeftover && entry.slot !== null ? (
        <Link
          className={secondary}
          href={`/plan/meals/new?leftoverOf=${entry.id}&date=${addCivilDays(entry.date, 1)}&slot=dinner`}
        >
          Plan leftovers
        </Link>
      ) : null}
      {entry.libraryId ? (
        <Link
          className={secondary}
          href={`/plan/library/${entry.libraryId}?date=${entry.date}`}
        >
          Saved meal & groceries
        </Link>
      ) : (
        <Link
          className={secondary}
          href={`/plan/library/new?from=${entry.id}&date=${entry.date}`}
        >
          Save to meal library
        </Link>
      )}
    </div>
  );
}

function PreparationItem({
  prep,
  entryId,
}: {
  prep: MealConnections["prep"][number];
  entryId: string;
}) {
  return (
    <li className="grid gap-1">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="font-medium">{prep.routine.title}</h3>
        <Badge variant={prep.status === "completed" ? "success" : "secondary"}>
          {prep.status === "open" ? "To do" : prep.status}
        </Badge>
      </div>
      <p className="text-base text-muted-foreground sm:text-sm">
        {formatZurichDayLabel(prep.due_date)}
      </p>
      {prep.routine.instructions ? (
        <p className="whitespace-pre-wrap text-base sm:text-sm">
          {prep.routine.instructions}
        </p>
      ) : null}
      <p className="text-base sm:text-sm">
        <Link href={`/plan/meals/${entryId}/prep/edit`}>Manage prep task</Link>
        {prep.status === "open" ? (
          <>
            {" "}
            · <Link href="/">Open Today</Link>
          </>
        ) : null}
      </p>
    </li>
  );
}

function MealPreparation({ entry, connections, day }: MealDetailsProps) {
  return (
    <section
      aria-labelledby="meal-prep-title"
      className="grid gap-4 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold" id="meal-prep-title">
          Preparation
        </h2>
        {connections.prep.length === 0 ? (
          <Link
            className={secondary}
            href={`/plan/meals/${entry.id}/prep?day=${day}`}
          >
            Add prep task
          </Link>
        ) : null}
      </div>
      {connections.prep.length ? (
        <ul role="list" className="grid list-none gap-4">
          {connections.prep.map((prep) => (
            <PreparationItem key={prep.id} prep={prep} entryId={entry.id} />
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground sm:text-sm">
          Need to thaw, soak, or prepare something ahead? Add a task and it will
          appear on Today when it’s due.
        </p>
      )}
    </section>
  );
}

function MealGrocery({ item }: { item: MealConnections["groceries"][number] }) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="font-medium wrap-anywhere">{item.name}</p>
        <p className="text-base text-muted-foreground sm:text-sm">
          {[item.quantity, item.unit].filter(Boolean).join(" ")}
        </p>
      </div>
      <Badge variant={item.state === "purchased" ? "success" : "secondary"}>
        {item.state === "claimed"
          ? "In cart"
          : item.state === "purchased"
            ? "Purchased"
            : "On the list"}
      </Badge>
    </li>
  );
}

function MealGroceries({
  entry,
  connections,
}: Pick<MealDetailsProps, "entry" | "connections">) {
  return (
    <section
      aria-labelledby="meal-groceries-title"
      className="grid gap-4 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="meal-groceries-title"
          className="font-heading text-xl font-semibold"
        >
          Groceries for this meal
        </h2>
        <Link className={secondary} href="/groceries">
          Open shopping list
        </Link>
      </div>
      {connections.groceries.length ? (
        <ul role="list" className="grid list-none divide-y divide-border">
          {connections.groceries.map((item) => (
            <MealGrocery item={item} key={item.id} />
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground sm:text-sm">
          {entry.isLeftover
            ? "Leftovers reuse the original meal, so groceries aren’t added again."
            : entry.slot === null
              ? "Default groceries are added when you give this idea a meal time."
              : "No linked groceries. Save default groceries in the meal library for the next time you plan it."}
        </p>
      )}
    </section>
  );
}

export function MealDetails({ entry, connections, day }: MealDetailsProps) {
  if (entry.removedAt) return <RemovedMealDetails entry={entry} day={day} />;
  return (
    <AppPage labelledBy="meal-title">
      <div className="grid max-w-3xl gap-6">
        <div>
          <Link className={secondary} href={mealPlanHref(day)}>
            Back to plan
          </Link>
        </div>
        <PageHeader
          titleId="meal-title"
          title={entry.title}
          eyebrow={
            entry.slot === null
              ? "Idea for this week"
              : `${formatZurichDayLabel(entry.date)} · ${entry.slot}`
          }
          trailing={
            <Link
              className={secondary}
              href={`/plan/meals/${entry.id}/edit?day=${day}`}
            >
              Edit meal
            </Link>
          }
        />
        {entry.isLeftover ? (
          <div>
            <Badge variant="warning">Leftovers</Badge>
            {entry.leftoverOfEntryId ? (
              <p className="pt-2 text-base sm:text-sm">
                <Link href={`/plan/meals/${entry.leftoverOfEntryId}`}>
                  See the original meal
                </Link>
              </p>
            ) : null}
          </div>
        ) : null}
        {entry.notes ? (
          <p className="whitespace-pre-wrap text-base text-pretty wrap-anywhere">
            {entry.notes}
          </p>
        ) : null}
        <MealActions entry={entry} day={day} />
        <MealPreparation entry={entry} connections={connections} day={day} />
        <MealGroceries entry={entry} connections={connections} />
      </div>
    </AppPage>
  );
}
