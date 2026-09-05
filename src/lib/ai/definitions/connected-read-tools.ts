import { z } from "zod";
import { recordKinds } from "@/domain/home-records/schema";
import { searchCursorSchema, searchFilters } from "@/domain/search/query";
import { isoDate, uuid, type AiToolDefinition } from "./schemas";

export const pageIndex = z.number().int().min(0).max(10000).default(0);
export const connectedReadSchemas = {
  get_projects: z.object({
    kind: z.enum(["project", "trip"]),
    archived: z.boolean().default(false),
    page: pageIndex,
  }),
  get_project: z.object({
    projectId: uuid,
    taskPage: pageIndex,
    archivedTasks: z.boolean().default(false),
  }),
  get_trip_bookings: z.object({
    projectId: uuid,
    page: pageIndex,
    archived: z.boolean().default(false),
  }),
  get_trip_booking: z.object({ projectId: uuid, bookingId: uuid }),
  get_home_records: z.object({
    kind: z.enum(recordKinds),
    parentId: uuid
      .optional()
      .describe(
        "For maintenance/routines, an inventory item ID; for options, a decision ID",
      ),
    query: z.string().trim().max(160).optional(),
    page: pageIndex,
    archived: z.boolean().default(false),
    attention: z.boolean().default(false),
  }),
  get_home_record: z.object({ kind: z.enum(recordKinds), recordId: uuid }),
  search_household: z.object({
    query: z.string().trim().min(2).max(120),
    type: z
      .enum(
        Object.keys(searchFilters) as [
          keyof typeof searchFilters,
          ...(keyof typeof searchFilters)[],
        ],
      )
      .default("all"),
    archived: z.boolean().default(false),
    cursor: searchCursorSchema.nullable().default(null),
  }),
  get_calendar_agenda: z.object({ date: isoDate.optional() }),
  get_calendar_event: z.object({
    eventId: uuid,
    recurrenceId: z.string().min(1).max(100).optional(),
  }),
  get_household_agenda: z.object({ date: isoDate.optional() }),
  get_calendar_connection: z.object({}),
};
const descriptions: Record<keyof typeof connectedReadSchemas, string> = {
  get_projects:
    "List projects or trips, with real IDs and updated_at edit versions. Page is zero-based; archived selects archived records only. Budgets are estimates in CHF centimes, never paid balances.",
  get_project:
    "Read a project/trip and its paged tasks, including IDs, assignments, completion and edit versions. Use archivedTasks to read archived tasks.",
  get_trip_bookings:
    "Read paged trip bookings in itinerary order, with local time zones, IDs and edit versions. Estimates do not represent payments. Archived selects archived bookings only.",
  get_trip_booking:
    "Read one booking within its trip, including confirmation, dates, time zones, status and updated_at edit version.",
  get_home_records:
    "Find paged inventory, contacts, commitments/renewals, decisions, documents, maintenance, decision options or asset-routine links. The routines kind means asset-routine links, not routine definitions. Includes IDs and edit versions. Archived selects archived records only; attention filters inventory/commitments needing attention.",
  get_home_record:
    "Read one Home record by kind and real ID, including relationships and edit version. Document metadata is not the file contents.",
  search_household:
    "Search private household records across plans, bookings, tasks, calendar, money, Home and daily workflows. Use returned IDs with detail tools before edits. Pass the returned cursor for another page.",
  get_calendar_agenda:
    "Read the shared calendar week containing a civil date, including expanded recurring occurrences and member attendance.",
  get_household_agenda:
    "Read Today’s connected household agenda: overdue and upcoming project tasks, trip bookings, renewals, and shared calendar events with actionable links and IDs.",
  get_calendar_event:
    "Read a calendar event's editable details, local form values, updated_at version, sync state and the Apple conflict version. Supply an agenda recurrenceId to inspect that specific occurrence. Does not expose Apple credentials or raw calendar transport data.",
  get_calendar_connection:
    "Read the shared iCloud connection status without credentials. Connecting an Apple account requires the member to enter credentials in calendar settings.",
};
export const CONNECTED_READ_TOOLS: readonly AiToolDefinition[] = Object.entries(
  connectedReadSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: "read",
  description: descriptions[name as keyof typeof descriptions],
}));
