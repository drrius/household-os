"use client";
import { useState } from "react";
import { restartEditFixture } from "./restart";
import { GroceryEditForm } from "@/ui/groceries/item-form.client";
import { GroceryCategoryManager } from "@/ui/groceries/category-manager.client";
import type { FormAction } from "@/lib/forms/action-state";
export function GroceryRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const [entity, setEntity] = useState("first");
  const save: FormAction = async (previous, form) => {
    const stale = form.has("itemId")
      ? form.get("updatedAt") !== `v${revision}`
      : form.get("previousName") !== `Produce ${revision}`;
    return {
      submissionId: previous.submissionId + 1,
      error: stale
        ? "Partner changed this record. Reopen it before saving."
        : "Snapshot accepted",
      values: Object.fromEntries(
        [...form].map(([key, value]) => [key, String(value)]),
      ),
    };
  };
  return (
    <main className="grid gap-8 p-4">
      <form action={restartEditFixture}>
        <button>Finish and reopen this page</button>
      </form>
      <button onClick={() => setRevision(revision + 1)}>
        Simulate partner refresh
      </button>
      <button onClick={() => setEntity("second")}>Open another record</button>
      <section aria-label="Item editor">
        <GroceryEditForm
          action={save}
          categories={[]}
          item={{
            id: entity,
            name: `Apples ${revision}`,
            quantity: "2",
            unit: null,
            note: `Note ${revision}`,
            category_id: null,
            updated_at: `v${revision}`,
            sort_order: revision,
          }}
        />
      </section>
      <section aria-label="Category editor">
        <GroceryCategoryManager
          action={save}
          data={[
            {
              id: entity,
              name: `Produce ${revision}`,
              sort_order: revision,
              archived_at: revision === 1 ? null : "2026-09-05T12:00:00Z",
            },
          ]}
        />
      </section>
    </main>
  );
}
