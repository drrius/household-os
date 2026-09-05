"use client";
import { useState } from "react";
import { RoutineForm } from "@/ui/forms/routine-form";
import type { FormAction } from "@/lib/forms/action-state";
const a = "00000000-0000-4000-8000-000000000191",
  b = "00000000-0000-4000-8000-000000000192";
export function RoutineRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const [id, setId] = useState(a);
  const save: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    error: "This routine changed. Reopen it before saving.",
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
  });
  return (
    <main className="grid gap-6 p-4">
      <button onClick={() => setRevision(2)}>Simulate partner refresh</button>
      <button onClick={() => setId(b)}>Open another routine</button>
      <p>Server revision {revision}</p>
      <RoutineForm
        action={save}
        areas={[{ id: a, name: "General" }]}
        pets={[]}
        members={[
          { user_id: a, display_name: "Alex" },
          { user_id: b, display_name: "Sam" },
        ]}
        defaultDate="2026-09-05"
        submitLabel="Save routine"
        defaults={{
          routineId: id,
          expectedUpdatedAt: `2026-09-05T00:00:00.00000${revision}Z`,
          idempotencyKey: `key-${revision}`,
          title: `Routine ${revision}`,
          instructions: `Instructions ${revision}`,
          areaId: a,
          assignmentPolicy: "shared",
          scheduleMode: "one_off",
          scheduleRule: {
            kind: "one_off",
            date: revision === 1 ? "2026-09-06" : "2026-09-07",
          },
          priority: "general",
        }}
      />
    </main>
  );
}
