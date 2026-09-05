"use client";
import { useState } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { LibraryMealEditor } from "@/ui/plan/library-meal-editor.client";
import { MealTemplateEditor } from "@/ui/plan/meal-template-editor.client";
const id = "10000000-0000-4000-8000-000000000041";
export function LibraryRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const version = `2026-09-05T00:00:0${revision}Z`;
  const action: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
    error: form.get("version")
      ? form.get("version") === version
        ? "Current snapshot accepted"
        : "Partner changed this meal. Reload before saving."
      : "Uncertain creation. Retry with the same identity.",
  });
  return (
    <main className="grid gap-8 p-4">
      <button onClick={() => setRevision(revision + 1)}>
        Simulate partner refresh
      </button>
      <section aria-label="Existing meal">
        <LibraryMealEditor
          id={id}
          date="2026-09-05"
          action={action}
          meal={{
            id,
            name: `Pasta ${revision}`,
            recipe_url: null,
            notes: `Notes ${revision}`,
            updated_at: version,
            archived_at: null,
            templates: [],
            archivedTemplates: [],
          }}
        />
      </section>
      <ExistingTemplate revision={revision} action={action} />
      <section aria-label="New meal">
        <LibraryMealEditor
          id={`${id}-${revision}`}
          date="2026-09-05"
          action={action}
        />
      </section>
      <section aria-label="New default grocery">
        <MealTemplateEditor
          id={`${id}-${revision}`}
          libraryId={id}
          date="2026-09-05"
          categories={[]}
          action={action}
        />
      </section>
    </main>
  );
}

function ExistingTemplate({
  revision,
  action,
}: {
  revision: number;
  action: FormAction;
}) {
  return (
    <section aria-label="Existing default grocery">
      <MealTemplateEditor
        id={id}
        libraryId={id}
        date="2026-09-05"
        action={action}
        categories={[
          { id: "produce", name: `Produce ${revision}` },
          { id: "dairy", name: "Dairy" },
        ]}
        template={{
          id,
          name: `Tomatoes ${revision}`,
          quantity: "2",
          unit: null,
          grocery_category_id: "produce",
          note: null,
          sort_order: 0,
          archived_at: null,
          updated_at: `2026-09-05T00:00:0${revision}Z`,
        }}
      />
    </section>
  );
}
