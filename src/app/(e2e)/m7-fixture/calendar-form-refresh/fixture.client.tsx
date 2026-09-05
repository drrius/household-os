"use client";
import { useState } from "react";
import { EventForm } from "@/ui/calendar/event-form";
import type { FormAction } from "@/lib/forms/action-state";
export function CalendarRefreshFixture() {
  const [revision, setRevision] = useState(1);
  const [entity, setEntity] = useState("first");
  const [occurrence, setOccurrence] = useState<string>();
  const save: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    error:
      form.get("version") !== `v${revision}`
        ? "Partner changed this event. Reopen it before saving."
        : "Snapshot accepted",
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
  });
  return (
    <main className="grid gap-8 p-4">
      <button onClick={() => setRevision(revision + 1)}>
        Simulate partner refresh
      </button>
      <button onClick={() => setEntity("second")}>Open another event</button>
      <button onClick={() => setOccurrence("20260908T100000")}>
        Open another occurrence
      </button>
      <EventForm
        id={entity}
        version={`v${revision}`}
        recurrenceId={occurrence}
        action={save}
        options={{ members: [], projects: [], canPublish: false }}
        input={{
          title: `Event ${revision}`,
          startsAt: `2026-09-0${revision}T10:00:00Z`,
          endsAt: `2026-09-0${revision}T11:00:00Z`,
          timeZone: "Europe/Zurich",
          allDay: false,
          attendance: "both",
          attendingMemberId: null,
          location: `Place ${revision}`,
          notes: `Notes ${revision}`,
          projectId: null,
          recurrenceRule: null,
        }}
      />
    </main>
  );
}
