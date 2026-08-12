import { addCivilDays } from "@/lib/ui/zurich-date";
import type { PlanViewModel } from "@/lib/read-models/plan";
import { AppPage } from "@/ui/primitives/app-page";
import { Button } from "@/ui/primitives/button";
import { Card } from "@/ui/primitives/card";
import { EmptyState } from "@/ui/primitives/empty-state";
import { PageHeader } from "@/ui/primitives/page-header";
import { StatusPill } from "@/ui/primitives/status-pill";
import { MealBoard } from "@/ui/plan/meal-board";

import styles from "./meal-board.module.css";

type PlanScreenProps = {
  plan: PlanViewModel;
};

type MealLibraryProps = {
  meals: PlanViewModel["library"];
};

function MealLibrary({ meals }: MealLibraryProps) {
  return (
    <section aria-labelledby="meal-library-title">
      <Card
        className={styles.libraryCard}
        header={
          <div className={styles.libraryHeading}>
            <h2 id="meal-library-title">Meal library</h2>
            <StatusPill>{meals.length} saved</StatusPill>
          </div>
        }
      >
        {meals.length === 0 ? (
          <EmptyState title="No saved meals yet">
            <p>Meals you save will appear here for quick reuse.</p>
          </EmptyState>
        ) : (
          <ul className={styles.libraryList} aria-label="Saved meals">
            {meals.map((meal) => (
              <li key={meal.id}>
                <StatusPill>{meal.title}</StatusPill>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </section>
  );
}

export function PlanScreen({ plan }: PlanScreenProps) {
  const previousWeek = addCivilDays(plan.weekStart, -7);
  const nextWeek = addCivilDays(plan.weekStart, 7);

  return (
    <AppPage labelledBy="plan-title">
      <PageHeader
        titleId="plan-title"
        title="This week"
        eyebrow={`${plan.rangeLabel} · ${plan.timeZoneLabel}`}
        trailing={
          <>
            <Button
              href={`/plan?week=${previousWeek}`}
              variant="secondary"
              aria-label="Previous week"
            >
              ←
            </Button>
            <Button
              href={`/plan?week=${nextWeek}`}
              variant="secondary"
              aria-label="Next week"
            >
              →
            </Button>
          </>
        }
      />
      <MealBoard days={plan.days} />
      <MealLibrary meals={plan.library} />
    </AppPage>
  );
}
