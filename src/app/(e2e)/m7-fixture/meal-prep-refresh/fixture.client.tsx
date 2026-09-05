"use client";
import { useState } from "react";
import { MealPreparationEdit } from "@/ui/plan/meal-preparation-edit";
import type { FormAction } from "@/lib/forms/action-state";
const a = "00000000-0000-4000-8000-000000000191";
const b = "00000000-0000-4000-8000-000000000192";
export function PreparationRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const [id, setId] = useState(a);
  const save: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    error: "This prep task changed. Reopen it before saving.",
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
  });
  return (
    <main className="grid gap-6 p-4">
      <button onClick={() => setRevision(2)}>Simulate partner refresh</button>
      <button onClick={() => setId(b)}>Open another prep task</button>
      <p>Server revision {revision}</p>
      <MealPreparationEdit
        action={save}
        entryId={id}
        idempotencyKey={revision === 1 ? a : b}
        members={[{ user_id: a, display_name: "Alex" }]}
        areas={[{ id: a, name: "Meals" }]}
        prep={{
          id,
          routine_id: id,
          due_date: revision === 1 ? "2026-09-06" : "2026-09-07",
          status: "open",
          planned_assignee_id: null,
          routine: {
            updated_at: `2026-09-05T00:00:00.00000${revision}Z`,
            title: `Prep ${revision}`,
            instructions: null,
            area_id: a,
            schedule_rule: { kind: "one_off", date: "2026-09-06" },
          },
        }}
      />
    </main>
  );
}
