import { ArchivedLibraryMeal } from "@/ui/plan/archived-library-meal";
import { MealPreparationEdit } from "@/ui/plan/meal-preparation-edit";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { parseMealPreparationEdit } from "@/lib/forms/meal-preparation";
import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
const id = "11111111-1111-4111-8111-111111111111";
async function validatePrep(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    (await settleFormAction(previous, form, async () => {
      parseMealPreparationEdit(form);
      throw new Error("Validated prep changes; this fixture does not save.");
    })) ?? { submissionId: previous.submissionId + 1 }
  );
}
async function fixtureRestore(
  previous: FormActionState,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  if (previous.submissionId === 0)
    return {
      submissionId: 1,
      error: "Could not restore this meal. Try again.",
    };
  (await cookies()).set("meal-restored", "1", { path: "/m7-fixture/meals" });
  redirect("/m7-fixture/meals/archived");
}
export async function ArchivedMealFixture() {
  if ((await cookies()).get("meal-restored")?.value === "1")
    return (
      <AppShell>
        <h1>Restored pasta</h1>
        <p>The saved meal is available again.</p>
      </AppShell>
    );
  return (
    <AppShell>
      <ArchivedLibraryMeal
        date="2026-09-10"
        restoreAction={fixtureRestore}
        meal={{
          id,
          name: "Archived pasta",
          recipe_url: "https://example.com/recipe",
          notes: "The original recipe is still here.",
          updated_at: "2026-09-05T00:00:00Z",
          archived_at: "2026-09-05T12:00:00Z",
          templates: [],
          archivedTemplates: [],
        }}
      />
    </AppShell>
  );
}
export function PreparationEditFixture() {
  return (
    <AppShell>
      <FormPage
        backHref="/m7-fixture/meals/details"
        title="Edit meal preparation"
        description="This stays a one-off task linked to Tomato pasta."
      >
        <MealPreparationEdit
          action={validatePrep}
          idempotencyKey={id}
          entryId={id}
          prep={{
            id,
            routine_id: id,
            due_date: "2026-09-09",
            status: "open",
            planned_assignee_id: null,
            routine: {
              updated_at: "2026-09-05T12:00:00.123456+00:00",
              title: "Make sauce",
              instructions: "Simmer gently",
              area_id: id,
              schedule_rule: { kind: "one_off", date: "2026-09-09" },
            },
          }}
          members={[{ user_id: id, display_name: "Darius" }]}
          areas={[{ id, name: "Meals" }]}
        />
      </FormPage>
    </AppShell>
  );
}
