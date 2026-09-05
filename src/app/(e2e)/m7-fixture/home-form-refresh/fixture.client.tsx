"use client";
import { useState } from "react";
import { restartEditFixture } from "./restart";
import { RecordForm } from "@/ui/home-records/record-form.client";
import type { FormAction } from "@/lib/forms/action-state";
export function HomeRefreshFixture({ seedId }: { seedId: string }) {
  const [revision, setRevision] = useState(1);
  const [entity, setEntity] = useState("first");
  const save: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    error:
      form.get("version") && form.get("version") !== `v${revision}`
        ? "Partner changed this record. Reopen it before saving."
        : "Validation failed; keep your draft",
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
  });
  return (
    <main className="grid gap-8 p-4">
      <form action={restartEditFixture}>
        <button>Finish and reopen this page</button>
      </form>
      <button onClick={() => setRevision(revision + 1)}>
        Simulate partner refresh
      </button>
      <button onClick={() => setEntity("second")}>Open another record</button>
      <section aria-label="Existing record">
        <RecordForm
          kind="contacts"
          record={{
            id: entity,
            updated_at: `v${revision}`,
            name: `Contact ${revision}`,
          }}
          options={{}}
          returnTo="/home/contacts"
          action={save}
        />
      </section>
      <section aria-label="New record">
        <RecordForm
          kind="contacts"
          record={{ id: `${seedId}-${revision}`, name: "" }}
          options={{}}
          returnTo="/home/contacts"
          action={save}
        />
      </section>
    </main>
  );
}
