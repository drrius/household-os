import "server-only";
import { calendarDetails } from "./calendar-details";
import { loadHouseholdAgenda } from "@/lib/read-models/household-agenda";
import { bookingLocalTime, bookingClockChoice } from "@/domain/trips/clock";
import { connectedReadSchemas as schemas } from "./definitions/connected-read-tools";
import {
  loadProject,
  loadProjects,
  loadProjectWork,
} from "@/lib/projects/queries";
import { loadBooking, loadBookings } from "@/lib/trips/queries";
import { listRecords, readRecord } from "@/lib/home-records/read";
import { loadHouseholdSearch } from "@/lib/search/read";
import { loadAgenda } from "@/lib/calendar/agenda";
import { getCalendarEvent, getConnectionSummary } from "@/lib/calendar/context";

export async function readConnectedTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_household_agenda")
    return loadHouseholdAgenda(schemas.get_household_agenda.parse(input).date);
  switch (name) {
    case "get_projects": {
      const value = schemas.get_projects.parse(input);
      return loadProjects(value.kind, value.archived, value.page);
    }
    case "get_project": {
      const value = schemas.get_project.parse(input);
      const project = await loadProject(value.projectId);
      if (!project) throw new Error("This plan is no longer available.");
      return {
        project,
        ...(await loadProjectWork(
          value.projectId,
          value.taskPage,
          value.archivedTasks,
        )),
      };
    }
    case "get_trip_bookings": {
      const value = schemas.get_trip_bookings.parse(input);
      return loadBookings(value.projectId, value.page, value.archived);
    }
    case "get_trip_booking": {
      const value = schemas.get_trip_booking.parse(input);
      const booking = await loadBooking(value.projectId, value.bookingId);
      if (!booking) throw new Error("This booking is no longer available.");
      return {
        booking,
        localEditValues: {
          starts_at: bookingLocalTime(booking.starts_at, booking.time_zone),
          ends_at: bookingLocalTime(booking.ends_at, booking.end_time_zone),
          start_clock: bookingClockChoice(booking.starts_at, booking.time_zone),
          end_clock: bookingClockChoice(booking.ends_at, booking.end_time_zone),
        },
      };
    }
    case "get_home_records":
      return readHomeList(input);
    case "get_home_record": {
      const value = schemas.get_home_record.parse(input);
      return { record: await readRecord(value.kind, value.recordId) };
    }
    case "search_household": {
      const value = schemas.search_household.parse(input);
      return {
        ...(await loadHouseholdSearch({
          q: value.query,
          type: value.type,
          archived: value.archived,
          cursor: value.cursor,
          error: null,
        })),
      };
    }
    default:
      return readCalendarTool(name, input);
  }
}

async function readCalendarTool(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  switch (name) {
    case "get_calendar_agenda": {
      const agenda = await loadAgenda(
        schemas.get_calendar_agenda.parse(input).date,
      );
      return {
        week: agenda.week,
        items: agenda.items,
        cancelled: agenda.cancelled,
        warnings: agenda.warnings,
        attention: agenda.attention.map((row) => ({
          id: row.id,
          title: row.title,
          syncState: row.state,
        })),
      };
    }
    case "get_calendar_event":
      return readEvent(input);
    case "get_calendar_connection": {
      const connection = await getConnectionSummary();
      return {
        connection: connection
          ? {
              id: connection.id,
              calendarName: connection.calendar_name,
              readOnly: connection.read_only,
              lastSyncedAt: connection.last_synced_at,
              needsAttention: Boolean(connection.last_error),
            }
          : null,
        setupPath: "/home/calendar",
      };
    }
    default:
      throw new Error(`Unknown connected read tool: ${name}`);
  }
}

async function readEvent(input: unknown): Promise<Record<string, unknown>> {
  const value = schemas.get_calendar_event.parse(input);
  const row = await getCalendarEvent(value.eventId);
  const {
    id,
    updated_at,
    title,
    starts_at,
    ends_at,
    time_zone,
    all_day,
    attendance,
    attending_member_id,
    location,
    notes,
    project_id,
    recurrence_rule,
    cancelled_at,
    sync_state,
  } = row;
  return {
    ...calendarDetails(row, value.recurrenceId),
    event: {
      id,
      updated_at,
      title,
      starts_at,
      ends_at,
      time_zone,
      all_day,
      attendance,
      attending_member_id,
      location,
      notes,
      project_id,
      recurrence_rule,
      cancelled_at,
      sync_state,
    },
  };
}

async function readHomeList(input: unknown) {
  const value = schemas.get_home_records.parse(input);
  const parentColumn =
    value.kind === "options"
      ? "decision_id"
      : value.kind === "maintenance" || value.kind === "routines"
        ? "asset_id"
        : null;
  if (value.parentId && !parentColumn)
    throw new Error("This record collection does not support a parent filter.");
  if (value.kind === "routines" && value.query)
    throw new Error(
      "Find the inventory item, then use its ID as parentId to read linked routines.",
    );
  return listRecords(
    value.kind,
    {
      q: value.query,
      page: String(value.page),
      archived: value.archived ? "1" : undefined,
      attention: value.attention ? "1" : undefined,
    },
    value.parentId && parentColumn
      ? { column: parentColumn, id: value.parentId }
      : undefined,
  );
}
