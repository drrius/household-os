import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
import { editVersion, recordIdentity } from "./project-tools";
const text = (max: number) => z.string().trim().max(max).default("");
const localTime = z
  .string()
  .regex(/^$|^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/)
  .default("")
  .describe(
    "Local date/time without offset, or empty when unknown. Pair with the named time zone.",
  );
const clockChoice = z.enum(["reject", "earlier", "later"]).default("reject");
export const bookingToolSchemas = {
  save_trip_booking: z.object({
    identity: recordIdentity,
    fields: z.object({
      project_id: uuid,
      kind: z.enum(["flight", "stay", "transport", "activity", "other"]),
      title: z.string().trim().min(1).max(200),
      status: z.enum(["idea", "booked", "cancelled"]).default("idea"),
      starts_at: localTime,
      ends_at: localTime,
      time_zone: z.string().min(1).max(100),
      end_time_zone: z.string().min(1).max(100),
      start_clock: clockChoice,
      end_clock: clockChoice,
      origin: text(500),
      destination: text(500),
      confirmation: text(300),
      website: text(2000),
      estimateCents: z
        .number()
        .int()
        .min(0)
        .max(2147483647)
        .nullable()
        .default(null),
      notes: text(8000),
    }),
  }),
  archive_trip_booking: z.object({
    projectId: uuid,
    id: uuid,
    updatedAt: editVersion,
    archived: z.boolean(),
  }),
};
export const BOOKING_TOOLS: readonly AiToolDefinition[] = [
  {
    name: "save_trip_booking",
    kind: "write",
    inputSchema: bookingToolSchemas.save_trip_booking,
    description:
      "Create or replace a booking's editable details. Read before edits and preserve unchanged fields using the returned local edit values and updated_at version. Time fields are LOCAL times in their named zones, not UTC. Repeated clock-change times require an explicit earlier/later choice; never guess it. Estimate is integer CHF centimes and does not post money. Requires an unarchived trip.",
  },
  {
    name: "archive_trip_booking",
    kind: "write",
    inputSchema: bookingToolSchemas.archive_trip_booking,
    description:
      "Archive or restore a booking with its current updated_at version. Requires an unarchived parent trip. Financial history is retained.",
  },
];
