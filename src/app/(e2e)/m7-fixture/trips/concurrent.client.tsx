"use client";
import { useState } from "react";
import { BookingForm } from "@/ui/trips/booking-form.client";
import type { FormAction } from "@/lib/forms/action-state";
import { booking } from "./fixture-data";
export function ConcurrentBooking({
  creating = false,
}: {
  creating?: boolean;
}) {
  const [revision, setRevision] = useState(1);
  const current = {
    ...booking,
    title: `Flight ${revision}`,
    updated_at: `2026-09-05T12:00:0${revision}Z`,
  };
  const action: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    values: Object.fromEntries(
      [...form].map(([key, value]) => [key, String(value)]),
    ),
    error:
      form.get("updatedAt") !== current.updated_at && !creating
        ? "Partner changed this booking. Reopen before saving."
        : "Keep this draft and try again.",
  });
  return (
    <>
      <button onClick={() => setRevision(revision + 1)}>
        Simulate partner refresh
      </button>
      <BookingForm
        id={
          creating
            ? `36000000-0000-4000-8000-${String(100 + revision).padStart(12, "0")}`
            : booking.id
        }
        projectId={booking.project_id}
        booking={creating ? undefined : current}
        action={action}
      />
    </>
  );
}
