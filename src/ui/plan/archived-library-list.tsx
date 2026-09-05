import Link from "next/link";
import type { ArchivedLibrary } from "@/lib/meals/library-archive";
import { mealPlanHref } from "@/lib/forms/meal-navigation";
import { buttonVariants } from "@/components/ui/button";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";
export function ArchivedLibraryList({
  library,
  date,
}: {
  library: ArchivedLibrary;
  date: string;
}) {
  const href = (page: number) =>
    `/plan/library/archived?date=${date}&page=${page}`;
  return (
    <AppPage labelledBy="archived-library-title">
      <Link
        className={buttonVariants({ variant: "outline", className: "w-fit" })}
        href={mealPlanHref(date)}
      >
        Back to plan
      </Link>
      <PageHeader
        title="Archived meals"
        titleId="archived-library-title"
        eyebrow="Meal library"
      />
      <p className="text-muted-foreground">
        Keep old favourites here. Open a meal to see its recipe or restore it to
        your library.
      </p>
      {library.meals.length ? (
        <ul className="grid max-w-3xl list-none divide-y">
          {library.meals.map((meal) => (
            <li key={meal.id} className="py-4">
              <Link
                className="block min-h-11 content-center font-medium"
                href={`/plan/library/${meal.id}?date=${date}`}
              >
                {meal.name}
              </Link>
              {meal.notes ? (
                <p className="line-clamp-2 text-muted-foreground">
                  {meal.notes}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p>
          {library.page > 1
            ? "No meals on this page. Go back to the previous page."
            : "No archived meals. Meals you archive will appear here."}
        </p>
      )}
      <nav
        aria-label="Archived meals pages"
        className="flex flex-wrap items-center gap-4"
      >
        {library.page > 1 ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={href(library.page - 1)}
          >
            Previous
          </Link>
        ) : null}
        <span className="text-sm text-muted-foreground">
          Page {library.page} · {library.total} archived{" "}
          {library.total === 1 ? "meal" : "meals"}
        </span>
        {library.page * 20 < library.total ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={href(library.page + 1)}
          >
            Next
          </Link>
        ) : null}
      </nav>
    </AppPage>
  );
}
