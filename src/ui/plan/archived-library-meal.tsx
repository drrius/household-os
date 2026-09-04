import Link from "next/link";
import { RestoreLibraryMeal } from "./restore-library-meal.client";
import type { FormActionState } from "@/lib/forms/action-state";
import type { LibraryMeal } from "@/lib/meals/library";
import { buttonVariants } from "@/components/ui/button";
import { AppPage } from "@/ui/layout/app-page";
import { PageHeader } from "@/ui/layout/page-header";

export function ArchivedLibraryMeal({
  meal,
  date,
  restoreAction,
}: {
  meal: LibraryMeal;
  date: string;
  restoreAction?: (
    previous: FormActionState,
    form: FormData,
  ) => Promise<FormActionState>;
}) {
  return (
    <AppPage labelledBy="archived-meal-title">
      <PageHeader
        title={meal.name}
        titleId="archived-meal-title"
        eyebrow="Archived saved meal"
      />
      <p className="max-w-2xl text-muted-foreground">
        This meal is archived. Its recipe and default groceries remain here for
        reference. Meals already on your plan keep their own details.
      </p>
      <RestoreLibraryMeal id={meal.id} date={date} action={restoreAction} />
      {meal.notes ? (
        <p className="max-w-2xl whitespace-pre-wrap wrap-anywhere">
          {meal.notes}
        </p>
      ) : null}
      {meal.recipe_url && /^https?:\/\//i.test(meal.recipe_url) ? (
        <Link
          className={buttonVariants({ className: "w-fit" })}
          href={meal.recipe_url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Open recipe ↗
        </Link>
      ) : null}
      {meal.templates.length ? (
        <section className="grid gap-3">
          <h2 className="text-xl font-semibold">Default groceries</h2>
          <ul className="list-inside list-disc">
            {meal.templates.map((template) => (
              <li key={template.id}>
                {[template.name, template.quantity, template.unit]
                  .filter(Boolean)
                  .join(" · ")}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <Link
        className={buttonVariants({ variant: "outline", className: "w-fit" })}
        href={`/plan/library/archived?date=${date}`}
      >
        Back to archived meals
      </Link>
    </AppPage>
  );
}
