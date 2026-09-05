import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
import { recordIdentity, editVersion } from "./project-tools";
const text = (max: number) => z.string().max(max).default("");
export const calendarToolSchemas = {
  save_calendar_event: z.object({
    identity: recordIdentity,
    recurrenceId: text(100),
    fields: z.object({
      title: z.string().trim().min(1).max(200),
      start: z.string().min(1).max(30),
      end: z.string().min(1).max(30),
      timeZone: z.string().min(1).max(100),
      allDay: z.boolean(),
      attendance: z.enum(["both", "one", "fyi"]),
      attendingMemberId: uuid.nullable().default(null),
      projectId: uuid.nullable().default(null),
      location: text(500),
      notes: text(8000),
      repeat: z.enum(["none", "daily", "weekly", "monthly", "yearly", "keep"]),
      until: text(10),
      publish: z.boolean().default(false),
    }),
  }),
  cancel_calendar_event: z.object({
    id: uuid,
    updatedAt: editVersion,
    recurrenceId: text(100),
  }),
  resolve_calendar_conflict: z.object({
    id: uuid,
    updatedAt: editVersion,
    choice: z.enum(["local", "remote"]),
  }),
  list_icloud_calendars: z.object({}),
  select_icloud_calendar: z.object({
    calendarUrl: z.string().min(1).max(2000),
  }),
  sync_icloud_calendar: z.object({}),
  disconnect_icloud_calendar: z.object({}),
};
const descriptions = {
  save_calendar_event:
    "Create or replace a shared calendar event. Start/end are local date-times in timeZone, or civil dates for all-day events (end is the last included day). Read before editing and preserve unchanged fields; use repeat=keep for existing recurrence. Supply a returned recurrenceId only to edit that occurrence. Publish explicitly opts into the existing editable iCloud connection. Creates have stable retry identity; no financial effect.",
  cancel_calendar_event:
    "Cancel an event or one occurrence using its last-read version and optional returned recurrenceId. Marks the connected event pending for iCloud sync; never reverses money.",
  resolve_calendar_conflict:
    "Keep the local or Apple version of a sync conflict using the current edit version. Read both versions first and ask the member which to keep when unclear.",
  list_icloud_calendars:
    "List calendars available through the already connected Apple account. Account credentials must be entered in /home/calendar, never in chat.",
  select_icloud_calendar:
    "Select a calendar URL returned by list_icloud_calendars. The existing connection must not yet have a selected calendar; never invent a URL.",
  sync_icloud_calendar:
    "Explicitly synchronize the household's selected iCloud calendar, sending pending local edits and fetching remote changes. Does not post money.",
  disconnect_icloud_calendar:
    "Disconnect the household's Apple calendar integration through the existing guarded command. Use only when the member asks to disconnect; local event copies remain available.",
};
export const CALENDAR_TOOLS: readonly AiToolDefinition[] = Object.entries(
  calendarToolSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name === "list_icloud_calendars" ? "read" : "write",
  description: descriptions[name as keyof typeof descriptions],
}));
