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

export function MealSection({ meals }: { meals: readonly MealGlance[] }) {
  return (
    <PageSection title="Meal and prep" titleId="today-meals-title">
      {meals.length > 0 ? (
        <div className="flex flex-col gap-4">
          {meals.map((meal) => (
            <Card className="bg-secondary" key={mealGlanceKey(meal)} size="sm">
              <CardHeader>
                <CardTitle>{mealGlanceLabel(meal)}</CardTitle>
                <CardAction>
                  <Badge variant="accent">
                    {meal.day === "today" ? "Today" : "Tomorrow"}
                  </Badge>
                </CardAction>
              </CardHeader>
              <CardContent>
                <strong>{meal.title}</strong>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState title="No meal planned">
          <p>Today’s meal plan is open.</p>
        </EmptyState>
      )}
    </PageSection>
  );
}
