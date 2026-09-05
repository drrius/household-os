import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import { bookingInstant, validateBookingZone } from "@/domain/trips/clock";
import type { TripBooking } from "@/domain/projects/types";
import { FormFieldError } from "@/lib/forms/field-error";
import {
  optionalAmount,
  recordId,
  recordVersion,
  safeBookingUrl,
} from "@/lib/projects/forms";
const text = (form: FormData, name: string, max: number) =>
  z
    .string()
    .max(max)
    .parse(String(form.get(name) ?? "").trim());
function clock(form: FormData, end: boolean, original?: string | null) {
  const name = end ? "ends_at" : "starts_at";
  const zoneField = end ? "end_time_zone" : "time_zone";
  const zone = text(form, zoneField, 100) || "Europe/Zurich";
  try {
    validateBookingZone(zone);
  } catch (error) {
    throw new FormFieldError(zoneField, (error as Error).message);
  }
  const choice = z
    .enum(["reject", "earlier", "later"])
    .parse(form.get(end ? "end_clock" : "start_clock") ?? "reject");
  try {
    return {
      instant: bookingInstant(text(form, name, 30), zone, choice, original),
      zone,
    };
  } catch (error) {
    throw new FormFieldError(name, (error as Error).message);
  }
}
export function parseBookingForm(form: FormData, original?: TripBooking) {
  const start = clock(form, false, original?.starts_at),
    end = clock(form, true, original?.ends_at);
  if (
    start.instant &&
    end.instant &&
    Temporal.Instant.compare(start.instant, end.instant) > 0
  )
    throw new FormFieldError(
      "ends_at",
      "The end must be after the start, including their time zones.",
    );
  const title = text(form, "title", 200);
  if (!title) throw new FormFieldError("title", "Give this booking a name.");
  return {
    id: recordId(form.get("id")),
    version: recordVersion(form),
    fields: {
      project_id: recordId(form.get("project_id")),
      kind: z
        .enum(["flight", "stay", "transport", "activity", "other"])
        .parse(form.get("kind")),
      title,
      status: z
        .enum(["idea", "booked", "cancelled"])
        .parse(form.get("status") ?? "idea"),
      starts_at: start.instant,
      ends_at: end.instant,
      time_zone: start.zone,
      end_time_zone: end.zone,
      origin: text(form, "origin", 500),
      destination: text(form, "destination", 500),
      confirmation: text(form, "confirmation", 300),
      website: safeBookingUrl(text(form, "website", 2000)),
      estimated_amount_cents: optionalAmount(form, "estimate"),
      notes: text(form, "notes", 8000),
    },
  };
}
