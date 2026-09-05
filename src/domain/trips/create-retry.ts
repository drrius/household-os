import { Temporal } from "@js-temporal/polyfill";
export function bookingCreateRetryMatches(
  existing: Record<string, unknown>,
  fields: Readonly<Record<string, string | number | null>>,
) {
  if (existing.archived_at !== null || existing.calendar_event_id !== null)
    return false;
  return Object.entries(fields).every(([key, value]) => {
    if (
      (key === "starts_at" || key === "ends_at") &&
      value !== null &&
      typeof existing[key] === "string"
    ) {
      try {
        return Temporal.Instant.from(String(value)).equals(
          Temporal.Instant.from(existing[key] as string),
        );
      } catch {
        return false;
      }
    }
    return existing[key] === value;
  });
}
