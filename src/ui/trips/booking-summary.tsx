import type { TripBooking } from "@/domain/projects/types";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
function time(instant: string | null, zone: string) {
  if (!instant) return "Time to decide";
  return new Intl.DateTimeFormat("en-CH", {
    timeZone: zone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(instant));
}
export function BookingSummary({ booking }: { booking: TripBooking }) {
  return (
    <div className="grid gap-3">
      <p className="text-sm capitalize text-muted-foreground">
        {booking.kind === "stay" ? "Hotel or stay" : booking.kind} ·{" "}
        {booking.status === "idea" ? "Considering" : booking.status}
        {booking.archived_at ? " · Archived" : ""}
      </p>
      <div className="grid gap-2 text-sm">
        <p>
          <time dateTime={booking.starts_at ?? undefined}>
            {time(booking.starts_at, booking.time_zone)}
          </time>
          {booking.starts_at ? (
            <span className="block text-muted-foreground">
              {booking.time_zone}
            </span>
          ) : null}
        </p>
        {booking.ends_at ? (
          <p>
            Until{" "}
            <time dateTime={booking.ends_at}>
              {time(booking.ends_at, booking.end_time_zone)}
            </time>
            <span className="block text-muted-foreground">
              {booking.end_time_zone}
            </span>
          </p>
        ) : null}
      </div>
      {booking.origin || booking.destination ? (
        <p className="wrap-anywhere">
          {[booking.origin, booking.destination].filter(Boolean).join(" → ")}
        </p>
      ) : null}
      {booking.estimated_amount_cents !== null ? (
        <p className="text-sm">
          Expected {formatCentimesAsFrancs(booking.estimated_amount_cents)}
        </p>
      ) : null}
    </div>
  );
}
