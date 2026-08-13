import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/ui/layout/empty-state";
import { PageSection } from "@/ui/layout/page-section";
import { RoutineCompleteControl } from "@/ui/today/routine-complete-control.client";
import type { MealGlance, MealSlot } from "@/ui/today/today-view-model";

function mealSlotLabel(slot: MealSlot): string {
  switch (slot) {
    case "breakfast":
      return "Breakfast";
    case "lunch":
      return "Lunch";
    case "dinner":
      return "Dinner";
    case null:
      return "Meal";
    default: {
      const exhaustiveSlot: never = slot;
      return exhaustiveSlot;
    }
  }
}

function mealGlanceKey(meal: MealGlance): string {
  switch (meal.kind) {
    case "meal":
      return meal.entryId;
    case "prep":
      return meal.occurrenceId;
    default: {
      const exhaustiveMeal: never = meal;
      return exhaustiveMeal;
    }
  }
}

function mealGlanceLabel(meal: MealGlance): string {
  switch (meal.kind) {
    case "meal":
      return mealSlotLabel(meal.slot);
    case "prep":
      return "Prep";
    default: {
      const exhaustiveMeal: never = meal;
      return exhaustiveMeal;
    }
  }
}

function mealDayBadge(day: MealGlance["day"]): string {
  switch (day) {
    case "today":
      return "Today";
    case "tomorrow":
      return "Tomorrow";
    case "overdue":
      return "Overdue";
    default: {
      const exhaustiveDay: never = day;
      return exhaustiveDay;
    }
  }
}

function PrepCard({ meal }: { meal: Extract<MealGlance, { kind: "prep" }> }) {
  return (
    <Card className="bg-secondary" size="sm">
      <CardHeader>
        <CardTitle>Prep</CardTitle>
        <CardAction>
          <Badge variant={meal.day === "overdue" ? "warning" : "accent"}>
            {mealDayBadge(meal.day)}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <RoutineCompleteControl
          row={{
            occurrenceId: meal.occurrenceId,
            title: meal.title,
            meta: meal.day === "overdue" ? "Overdue prep" : "Meal prep",
            tone: meal.tone,
            canComplete: meal.canComplete,
          }}
        />
      </CardContent>
    </Card>
  );
}

export function MealSection({ meals }: { meals: readonly MealGlance[] }) {
  return (
    <PageSection title="Meal and prep" titleId="today-meals-title">
      {meals.length > 0 ? (
        <div className="flex flex-col gap-4">
          {meals.map((meal) =>
            meal.kind === "prep" ? (
              <PrepCard key={mealGlanceKey(meal)} meal={meal} />
            ) : (
              <Link
                className="block no-underline transition-transform hover:scale-[1.02] motion-reduce:transition-none motion-reduce:hover:scale-100"
                href={`/plan/meals/${meal.entryId}`}
                key={mealGlanceKey(meal)}
              >
                <Card className="bg-secondary" size="sm">
                  <CardHeader>
                    <CardTitle>{mealGlanceLabel(meal)}</CardTitle>
                    <CardAction>
                      <Badge variant="accent">{mealDayBadge(meal.day)}</Badge>
                    </CardAction>
                  </CardHeader>
                  <CardContent>
                    <strong>{meal.title}</strong>
                  </CardContent>
                </Card>
              </Link>
            ),
          )}
        </div>
      ) : (
        <EmptyState title="No meal planned">
          <p>Today’s meal plan is open.</p>
        </EmptyState>
      )}
    </PageSection>
  );
}
