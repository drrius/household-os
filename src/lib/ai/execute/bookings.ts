import "server-only";
import { revalidatePath } from "next/cache";
import { bookingToolSchemas as schemas } from "../definitions/booking-tools";
import type { AiWriteHandler } from "./types";
import { commandForm, invocationRecordId } from "./connected-input";
import { loadProject } from "@/lib/projects/queries";
import { loadBooking } from "@/lib/trips/queries";
import { parseBookingForm } from "@/lib/trips/forms";
import { saveBooking, archiveBooking } from "@/lib/trips/commands";
import { formatCentimesField } from "@/domain/money/chf";
import { requireMemberContext } from "@/lib/auth/member-context";

async function activeTrip(id: string) {
  const project = await loadProject(id);
  if (!project || project.kind !== "trip" || project.archived_at)
    throw new Error("Open an active trip before changing bookings.");
}
function refresh(id: string) {
  revalidatePath(`/plan/projects/${id}`, "layout");
  revalidatePath("/plan/trips");
  revalidatePath("/");
}
export const BOOKING_HANDLERS: Record<string, AiWriteHandler> = {
  save_trip_booking: async (input, context) => {
    const value = schemas.save_trip_booking.parse(input);
    const member = await requireMemberContext();
    await activeTrip(value.fields.project_id);
    const identity = value.identity;
    const id =
      identity.mode === "create"
        ? invocationRecordId(`${member.householdId}:${context.idempotencyKey}`)
        : identity.id;
    const original =
      identity.mode === "update"
        ? await loadBooking(value.fields.project_id, id)
        : null;
    if (identity.mode === "update" && (!original || original.archived_at))
      throw new Error("Restore this booking before editing it.");
    const { estimateCents, ...fields } = value.fields;
    const form = commandForm({
      ...fields,
      id,
      updatedAt: identity.mode === "update" ? identity.updatedAt : null,
      estimate:
        estimateCents === null ? "" : formatCentimesField(estimateCents),
    });
    await saveBooking(parseBookingForm(form, original ?? undefined));
    refresh(fields.project_id);
    return { id, projectId: fields.project_id };
  },
  archive_trip_booking: async (input) => {
    const value = schemas.archive_trip_booking.parse(input);
    await activeTrip(value.projectId);
    await archiveBooking(
      value.projectId,
      value.id,
      value.updatedAt,
      value.archived,
    );
    refresh(value.projectId);
    return { id: value.id, projectId: value.projectId };
  },
};
