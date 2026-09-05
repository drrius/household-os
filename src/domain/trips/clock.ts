import { Temporal } from "@js-temporal/polyfill";
export type ClockChoice = "reject" | "earlier" | "later";
export function bookingLocalTime(instant: string | null, zone: string) {
  return instant
    ? Temporal.Instant.from(instant)
        .toZonedDateTimeISO(zone)
        .toPlainDateTime()
        .toString({ smallestUnit: "second" })
    : "";
}
export function bookingClockChoice(
  instant: string | null,
  zone: string,
): ClockChoice {
  if (!instant) return "reject";
  const actual = Temporal.Instant.from(instant);
  const plain = actual.toZonedDateTimeISO(zone).toPlainDateTime();
  const first = plain
    .toZonedDateTime(zone, { disambiguation: "earlier" })
    .toInstant();
  const last = plain
    .toZonedDateTime(zone, { disambiguation: "later" })
    .toInstant();
  if (first.equals(last)) return "reject";
  return actual.equals(first) ? "earlier" : "later";
}
export function validateBookingZone(zone: string) {
  if (!zone || /^[+-]/.test(zone))
    throw new Error("Choose a named time zone, such as Europe/Zurich.");
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
  } catch {
    throw new Error("Choose a valid named time zone, such as Europe/Zurich.");
  }
  return zone;
}
export function bookingInstant(
  local: string,
  zone: string,
  choice: ClockChoice,
  original?: string | null,
) {
  validateBookingZone(zone);
  if (!local) return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(local))
    throw new Error("Choose a valid local date and time.");
  const plain = Temporal.PlainDateTime.from(local, { overflow: "reject" });
  let zoned: Temporal.ZonedDateTime;
  try {
    zoned = plain.toZonedDateTime(zone, { disambiguation: choice });
  } catch {
    throw new Error(
      "This time is skipped or repeated by a clock change. Check the time or choose its first or second occurrence.",
    );
  }
  if (!zoned.toPlainDateTime().equals(plain))
    throw new Error(
      "This local time does not exist because the clocks move forward.",
    );
  if (
    original &&
    bookingLocalTime(original, zone) ===
      plain.toString({ smallestUnit: "second" }) &&
    bookingClockChoice(original, zone) === choice
  )
    return Temporal.Instant.from(original).toString();
  return zoned.toInstant().toString();
}
