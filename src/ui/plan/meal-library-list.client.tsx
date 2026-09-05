"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const subscribeToHydration = () => () => {};
const hydratedSnapshot = () => true;
const serverSnapshot = () => false;

type LibraryMeal = { id: string; title: string };

export function MealLibraryList({
  meals,
  date,
  slot = "dinner",
  choosing = false,
}: {
  meals: readonly LibraryMeal[];
  date: string;
  slot?: string;
  choosing?: boolean;
}) {
  const [search, setSearch] = useState("");
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    hydratedSnapshot,
    serverSnapshot,
  );
  const filtered = meals.filter((meal) =>
    meal.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
  );
  return (
    <div className="grid gap-4">
      {meals.length > 4 ? (
        <Input
          aria-label="Find a saved meal"
          disabled={!hydrated}
          name="mealSearch"
          placeholder="Find a saved meal…"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      ) : null}
      {filtered.length ? (
        <ul role="list" className="grid list-none divide-y divide-border">
          {filtered.map((meal) => (
            <li
              key={meal.id}
              className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div className="min-w-0 flex-1 font-medium wrap-anywhere">
                <Link
                  className="no-underline hover:underline"
                  href={`/plan/library/${meal.id}?date=${date}`}
                >
                  {meal.title}
                </Link>
              </div>
              <Link
                className={buttonVariants({
                  variant: "outline",
                  className: "no-underline",
                })}
                aria-label={`Plan ${meal.title}`}
                href={`/plan/meals/new?libraryId=${meal.id}&date=${date}&slot=${slot}`}
              >
                {choosing ? "Choose" : "Plan meal"}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-base text-muted-foreground sm:text-sm">
          {meals.length
            ? "No saved meals match. Try another name."
            : "Save meals you both enjoy, with the groceries you usually need."}
        </p>
      )}
    </div>
  );
}
