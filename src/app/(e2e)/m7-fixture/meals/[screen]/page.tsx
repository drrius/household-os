import {
  ArchivedMealFixture,
  PreparationEditFixture,
} from "@/app/(e2e)/m7-fixture/meals/lifecycle";
import { notFound } from "next/navigation";

import { buildPlanViewModel } from "@/lib/read-models/plan";
import { MealDetails } from "@/ui/plan/meal-details";
import { CreateMealForm } from "@/ui/plan/new-meal-forms";
import { PlanScreen } from "@/ui/plan/plan-screen";
import { AppShell } from "@/ui/shell/app-shell";

const mealId = "11111111-1111-4111-8111-111111111111";
const libraryId = "22222222-2222-4222-8222-222222222222";

function renderDetails() {
  return (
    <AppShell>
      <MealDetails
        day="2026-09-10"
        entry={{
          id: mealId,
          title: "Tomato pasta",
          date: "2026-09-10",
          slot: "dinner",
          notes: "Use the ripe tomatoes.\nKeep some sauce for lunch.",
          recipeUrl: "https://example.com/recipe",
          isLeftover: false,
          libraryId,
        }}
        connections={{
          groceries: [
            {
              id: "grocery",
              name: "Tomatoes",
              quantity: "2",
              unit: "tins",
              state: "active",
            },
          ],
          prep: [
            {
              id: mealId,
              routine_id: mealId,
              due_date: "2026-09-09",
              status: "open",
              routine: {
                title: "Make the sauce",
                instructions: "Simmer gently.",
              },
            },
          ],
        }}
      />
    </AppShell>
  );
}

function renderNew() {
  return (
    <AppShell>
      <CreateMealForm date="2026-09-10" slot="idea" />
    </AppShell>
  );
}

function renderPlan() {
  const plan = buildPlanViewModel({
    today: "2026-09-05",
    weekStartParam: "2026-09-07",
    entries: [
      {
        id: mealId,
        date: "2026-09-07",
        slot: null,
        title_snapshot: "Pizza night",
        notes: "Try the new dough",
        leftover_of_entry_id: null,
      },
      {
        id: libraryId,
        date: "2026-09-10",
        slot: "dinner",
        title_snapshot: "Tomato pasta",
        notes: null,
        leftover_of_entry_id: null,
      },
    ],
    library: ["Tomato pasta", "Pizza", "Soup", "Tacos", "Risotto"].map(
      (name, index) => ({ id: `saved-${index}`, name }),
    ),
    prep: [],
  });
  return (
    <AppShell>
      <PlanScreen plan={plan} selectedDay="2026-09-10" />
    </AppShell>
  );
}

export default async function MealWorkflowFixture({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { screen } = await params;
  if (screen === "archived") return <ArchivedMealFixture />;
  if (screen === "prep-edit") return <PreparationEditFixture />;
  if (screen === "details") return renderDetails();
  if (screen === "new") return renderNew();
  if (screen === "plan") return renderPlan();
  notFound();
}
