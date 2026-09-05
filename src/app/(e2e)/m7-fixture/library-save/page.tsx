import { z } from "zod";
import { readFixture } from "./store";
import { notFound } from "next/navigation";
import { LibraryMealEditor } from "@/ui/plan/library-meal-editor.client";
import { MealTemplateEditor } from "@/ui/plan/meal-template-editor.client";
import { saveFixture } from "./actions";
const id = "10000000-0000-4000-8000-000000000041";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ run?: string | string[] }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const parsed = z.uuid().safeParse((await searchParams).run);
  if (!parsed.success) notFound();
  const run = parsed.data;
  const state = readFixture(run);
  const action = saveFixture.bind(null, run);
  return (
    <main className="grid gap-8 p-4">
      <p>Groceries added: {state.ids.length}</p>
      <section aria-label="Existing meal">
        <LibraryMealEditor
          key={id}
          id={id}
          action={action}
          date="2026-09-05"
          meal={{
            id,
            name: state.name,
            updated_at: `2026-09-05T00:00:${String(state.revision).padStart(2, "0")}Z`,
            notes: null,
            recipe_url: null,
            archived_at: null,
            templates: [],
            archivedTemplates: [],
          }}
        />
      </section>
      <section aria-label="New default grocery">
        <MealTemplateEditor
          key={`${id}:new`}
          id={crypto.randomUUID()}
          libraryId={id}
          date="2026-09-05"
          categories={[]}
          action={action}
        />
      </section>
    </main>
  );
}
