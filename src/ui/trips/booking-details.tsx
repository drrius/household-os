import Link from "next/link";
import type { TripBooking } from "@/domain/projects/types";
import { buttonVariants } from "@/components/ui/button";
import { RecordAction } from "@/ui/projects/record-action.client";
import { archiveBookingAction } from "@/app/(product)/plan/projects/[projectId]/bookings/actions";
import type { FormAction } from "@/lib/forms/action-state";
import { BookingSummary } from "./booking-summary";
function safeLink(url: string) {
  try {
    const parsed = new URL(url);
    return ["https:", "http:"].includes(parsed.protocol) &&
      !parsed.username &&
      !parsed.password
      ? parsed.href
      : null;
  } catch {
    return null;
  }
}
export function BookingDetails({
  booking,
  tripArchived,
  action = archiveBookingAction,
  back,
}: {
  booking: TripBooking;
  tripArchived: boolean;
  action?: FormAction;
  back?: string;
}) {
  const base = `/plan/projects/${booking.project_id}/bookings/${booking.id}`,
    website = safeLink(booking.website);
  return (
    <article className="grid max-w-3xl gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1
          id="booking-title"
          className="font-heading text-3xl font-semibold wrap-anywhere"
        >
          {booking.title}
        </h1>
        {!tripArchived && !booking.archived_at ? (
          <Link
            href={`${base}/edit${back ? `?back=${encodeURIComponent(back)}` : ""}`}
            className={buttonVariants({ variant: "outline" })}
          >
            Edit booking
          </Link>
        ) : null}
      </div>
      <BookingSummary booking={booking} />
      {booking.confirmation ? (
        <div className="rounded-xl bg-muted p-4">
          <h2 className="text-sm text-muted-foreground">
            Confirmation / flight number
          </h2>
          <p className="mt-1 font-mono text-lg wrap-anywhere select-all">
            {booking.confirmation}
          </p>
        </div>
      ) : null}
      {website ? (
        <a
          href={website}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "outline", className: "w-fit" })}
        >
          Open booking ↗
        </a>
      ) : null}
      {booking.notes ? (
        <p className="whitespace-pre-wrap leading-relaxed wrap-anywhere">
          {booking.notes}
        </p>
      ) : null}
      {booking.estimated_amount_cents !== null ? (
        <p className="text-sm text-muted-foreground">
          Expected costs help you plan. They do not change who owes whom.
        </p>
      ) : null}
      <BookingLifecycle
        booking={booking}
        tripArchived={tripArchived}
        action={action}
        back={back}
      />
    </article>
  );
}

function BookingLifecycle({
  booking,
  tripArchived,
  action,
  back,
}: {
  booking: TripBooking;
  tripArchived: boolean;
  action: FormAction;
  back?: string;
}) {
  return (
    <>
      {" "}
      {tripArchived ? (
        <p className="rounded-xl border p-4 text-muted-foreground">
          Restore the trip to change this booking.
        </p>
      ) : (
        <details className="border-t pt-4" open={Boolean(booking.archived_at)}>
          <summary className="min-h-11 cursor-pointer content-center font-medium">
            {booking.archived_at
              ? "This booking is archived"
              : "Remove from the itinerary"}
          </summary>
          <div className="grid gap-4 pt-3">
            <p className="text-sm text-muted-foreground">
              Archiving hides the booking from your itinerary and preserves its
              history. It does not cancel a reservation or reverse a payment.
            </p>
            <RecordAction
              action={action}
              fields={{
                project_id: booking.project_id,
                back: back ?? "",
                id: booking.id,
                updatedAt: booking.updated_at,
                archived: booking.archived_at ? "false" : "true",
              }}
              label={
                booking.archived_at ? "Restore booking" : "Archive booking"
              }
            />
          </div>
        </details>
      )}
    </>
  );
}
