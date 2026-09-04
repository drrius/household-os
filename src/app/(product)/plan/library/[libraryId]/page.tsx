import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { mealDate, mealPlanHref } from "@/lib/forms/meal-navigation";
import { loadGroceryFormOptions } from "@/lib/forms/options";
import { loadLibraryMeal } from "@/lib/meals/library";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
import { LibraryMealForm } from "@/ui/plan/library-meal-form";
import {
  LibraryGroceries,
  ArchiveLibraryMeal,
} from "@/ui/plan/library-groceries";

export default async function LibraryMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ libraryId: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { libraryId } = await params;
  const meal = await loadLibraryMeal(libraryId);
  if (!meal) notFound();
  const { date: requestedDate } = await searchParams;
  const date = mealDate(requestedDate);
  const categories = await loadGroceryFormOptions();
  const secondary = buttonVariants({
    variant: "outline",
    className: "no-underline",
  });
  return (
    <AppPage labelledBy="saved-meal-title">
      <div className="grid max-w-3xl gap-6">
        <div>
          <Link className={secondary} href={mealPlanHref(date)}>
            Back to plan
          </Link>
        </div>
        <PageHeader
          titleId="saved-meal-title"
          title={meal.name}
          eyebrow="Saved meal"
          trailing={
            <Link
              className={buttonVariants({ className: "no-underline" })}
              href={`/plan/meals/new?libraryId=${meal.id}&date=${date}&slot=dinner`}
            >
              Plan this meal
            </Link>
          }
        />
        {meal.notes ? (
          <p className="whitespace-pre-wrap text-base wrap-anywhere">
            {meal.notes}
          </p>
        ) : null}
        {meal.recipe_url && /^https?:\/\//i.test(meal.recipe_url) ? (
          <div>
            <Link
              className={secondary}
              href={meal.recipe_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open recipe ↗
            </Link>
          </div>
        ) : null}
        <details className="rounded-xl border p-4">
          <summary className="cursor-pointer py-2 font-medium">
            Edit saved meal
          </summary>
          <div className="pt-4">
            <LibraryMealForm meal={meal} date={date} />
          </div>
        </details>
        <LibraryGroceries meal={meal} date={date} categories={categories} />
        <ArchiveLibraryMeal meal={meal} date={date} />
      </div>
    </AppPage>
  );
}
