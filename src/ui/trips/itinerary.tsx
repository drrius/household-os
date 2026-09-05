import Link from "next/link";
import { Plus } from "lucide-react";
import type { TripBooking } from "@/domain/projects/types";
import { buttonVariants } from "@/components/ui/button";
import { BookingSummary } from "./booking-summary";
type Props = {
  projectId: string;
  bookings: TripBooking[];
  archived: boolean;
  showArchived: boolean;
  page: number;
  hasMore: boolean;
  taskPage?: string;
  archivedTasks?: string;
};
export function TripItinerary({
  projectId,
  bookings,
  archived,
  showArchived,
  page,
  hasMore,
  taskPage,
  archivedTasks,
}: Props) {
  const base = `/plan/projects/${projectId}`;
  const href = (next: number, show = showArchived) => {
    const query = new URLSearchParams({ bookingPage: String(next) });
    if (show) query.set("archivedBookings", "1");
    if (taskPage && /^\d{1,6}$/.test(taskPage)) query.set("taskPage", taskPage);
    if (archivedTasks === "1") query.set("archivedTasks", "1");
    return `${base}?${query}#itinerary`;
  };
  return (
    <section
      id="itinerary"
      aria-labelledby="itinerary-title"
      className="grid scroll-mt-6 gap-5 border-t pt-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2
          id="itinerary-title"
          className="font-heading text-2xl font-semibold"
        >
          Itinerary & bookings
        </h2>
        {!archived ? (
          <Link
            className={buttonVariants({ variant: "outline" })}
            href={`${base}/bookings/new?back=${encodeURIComponent(href(page))}`}
          >
            <Plus className="size-4" />
            Add booking
          </Link>
        ) : null}
      </div>
      <p className="text-muted-foreground">
        Flights, stays and plans in time order. Times are local to each place;
        ideas without dates come last.
      </p>
      <Link
        className="min-h-11 w-fit content-center text-sm underline"
        href={href(0, !showArchived)}
      >
        {showArchived ? "Show current bookings" : "View archived bookings"}
      </Link>
      <BookingList
        bookings={bookings}
        base={base}
        showArchived={showArchived}
        back={href(page)}
      />
      <BookingPagination page={page} hasMore={hasMore} href={href} />
    </section>
  );
}

function BookingList({
  bookings,
  base,
  showArchived,
  back,
}: {
  bookings: TripBooking[];
  base: string;
  showArchived: boolean;
  back: string;
}) {
  return (
    <>
      {" "}
      {bookings.length ? (
        <ol className="grid list-none gap-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="rounded-2xl border p-4">
              <Link
                className="block min-h-11 content-center text-lg font-semibold wrap-anywhere underline-offset-4 hover:underline"
                href={`${base}/bookings/${booking.id}?back=${encodeURIComponent(back)}`}
              >
                {booking.title}
              </Link>
              <BookingSummary booking={booking} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="rounded-2xl border border-dashed p-5 text-muted-foreground">
          {showArchived
            ? "No archived bookings."
            : "Nothing planned yet. Add a flight, stay or idea to start your itinerary."}
        </p>
      )}
    </>
  );
}

function BookingPagination({
  page,
  hasMore,
  href,
}: {
  page: number;
  hasMore: boolean;
  href: (page: number) => string;
}) {
  return (
    <>
      {" "}
      {page > 0 || hasMore ? (
        <nav
          aria-label="Itinerary pages"
          className="flex justify-between gap-4"
        >
          {page > 0 ? (
            <Link
              className="min-h-11 content-center underline"
              href={href(page - 1)}
            >
              Previous
            </Link>
          ) : (
            <span />
          )}
          {hasMore ? (
            <Link
              className="min-h-11 content-center underline"
              href={href(page + 1)}
            >
              Next
            </Link>
          ) : null}
        </nav>
      ) : null}
    </>
  );
}
