import { notFound } from "next/navigation";
import { BookingForm } from "@/ui/trips/booking-form.client";
import { BookingDetails } from "@/ui/trips/booking-details";
import { TripItinerary } from "@/ui/trips/itinerary";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import { parseBookingForm } from "@/lib/trips/forms";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { booking } from "./fixture-data";
import { ConcurrentBooking } from "./concurrent.client";
async function validate(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    (await settleFormAction(previous, form, async () => {
      const parsed = parseBookingForm(form);
      throw new Error(
        `Booking checked: ${parsed.fields.starts_at ?? "undated"} → ${parsed.fields.ends_at ?? "undated"}. Estimate ${parsed.fields.estimated_amount_cents ?? "none"} centimes.`,
      );
    })) ?? { submissionId: previous.submissionId + 1 }
  );
}
async function rejectArchive(
  previous: FormActionState,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return {
    submissionId: previous.submissionId + 1,
    error: "Partner changed this booking. Reload before trying again.",
  };
}
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { view } = await searchParams;
  return (
    <AppShell>
      {view === "details" || view === "archived" || view === "archived-trip" ? (
        <BookingDetails
          booking={{
            ...booking,
            archived_at: view === "archived" ? "2026-09-05T12:00:00Z" : null,
          }}
          tripArchived={view === "archived-trip"}
          action={rejectArchive}
        />
      ) : view === "itinerary" ? (
        <TripItinerary
          projectId={booking.project_id}
          archived={false}
          showArchived={false}
          page={1}
          hasMore
          bookings={[
            booking,
            {
              ...booking,
              id: "36000000-0000-4000-8000-000000000021",
              title: "Hotel in Manhattan",
              kind: "stay",
              starts_at: "2026-10-07T19:00:00Z",
              ends_at: "2026-10-12T15:00:00Z",
              time_zone: "America/New_York",
              end_time_zone: "America/New_York",
              origin: "",
              destination: "Manhattan",
            },
            {
              ...booking,
              id: "36000000-0000-4000-8000-000000000022",
              title: "Museum afternoon",
              kind: "activity",
              status: "idea",
              starts_at: null,
              ends_at: null,
            },
          ]}
        />
      ) : (
        <FormPage
          title="Add booking"
          description="New York together"
          backHref="/plan/trips"
        >
          {view === "concurrent" ||
          view === "new-refresh" ||
          view === "zone-refresh" ? (
            <ConcurrentBooking
              creating={view === "new-refresh"}
              refreshZones={view === "zone-refresh"}
            />
          ) : (
            <BookingForm
              id={booking.id}
              projectId={booking.project_id}
              action={validate}
            />
          )}
        </FormPage>
      )}
    </AppShell>
  );
}
