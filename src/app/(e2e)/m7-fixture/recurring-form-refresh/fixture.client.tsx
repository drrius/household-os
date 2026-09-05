"use client";
import { useState } from "react";
import { RecurringFormClient } from "@/ui/money/recurring-form.client";
import type { FormAction } from "@/lib/forms/action-state";
const a = "00000000-0000-4000-8000-000000000001",
  b = "00000000-0000-4000-8000-000000000002";
export function RecurringRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const [id, setId] = useState(a);
  const save: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    error: "This recurring expense changed. Reopen it before saving.",
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
  });
  return (
    <main className="grid gap-6 p-4">
      <button onClick={() => setRevision(2)}>
        Simulate partner or scheduler refresh
      </button>
      <button onClick={() => setId(b)}>Open another rule</button>
      <p>Server revision {revision}</p>
      <RecurringFormClient
        action={save}
        idempotencyKey={`key-${revision}`}
        today="2026-09-05"
        viewerId={a}
        members={[
          { user_id: a, display_name: "Alex" },
          { user_id: b, display_name: "Sam" },
        ]}
        categories={[]}
        rule={{
          id,
          updated_at: `2026-09-05T00:00:00.00000${revision}Z`,
          description: `Rent ${revision}`,
          amount_cents: revision * 1000,
          payer_member_id: a,
          proposed_allocations: [
            { memberId: a, allocatedCents: revision * 500 },
            { memberId: b, allocatedCents: revision * 500 },
          ],
          category_id: null,
          schedule_kind: "monthly",
          iso_weekday: null,
          day_of_month: 1,
          active: true,
          next_occurrence_on: revision === 1 ? "2026-10-01" : "2026-11-01",
        }}
      />
    </main>
  );
}
