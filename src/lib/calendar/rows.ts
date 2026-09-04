import type { CalendarEventInput } from "@/domain/calendar/types";
export type CalendarRow = {
  id: string;
  household_id: string;
  updated_at: string;
  title: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  all_day: boolean;
  attendance: "both" | "one" | "fyi";
  attending_member_id: string | null;
  location: string;
  notes: string;
  project_id: string | null;
  recurrence_rule: string | null;
  cancelled_at: string | null;
  ical_uid: string;
  ical_data: string | null;
  ical_edit_base: string | null;
  connection_id: string | null;
  remote_href: string | null;
  remote_etag: string | null;
  sync_state: "local" | "pending" | "synced" | "conflict";
  last_synced_ical: string | null;
  remote_conflict_ical: string | null;
  remote_conflict_etag: string | null;
  last_sync_error: string | null;
};
export type ConnectionSummary = {
  id: string;
  calendar_name: string | null;
  selected_calendar_url: string | null;
  read_only: boolean;
  last_synced_at: string | null;
  last_error: string | null;
};
export const CONNECTION_SUMMARY =
  "id,calendar_name,selected_calendar_url,read_only,last_synced_at,last_error";
export function inputFromRow(row: CalendarRow): CalendarEventInput {
  return {
    title: row.title,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    timeZone: row.time_zone,
    allDay: row.all_day,
    attendance: row.attendance,
    attendingMemberId: row.attending_member_id,
    location: row.location,
    notes: row.notes,
    projectId: row.project_id,
    recurrenceRule: row.recurrence_rule,
  };
}
export function rowFields(input: CalendarEventInput) {
  return {
    title: input.title,
    starts_at: input.startsAt,
    ends_at: input.endsAt,
    time_zone: input.timeZone,
    all_day: input.allDay,
    attendance: input.attendance,
    attending_member_id: input.attendingMemberId,
    location: input.location,
    notes: input.notes,
    project_id: input.projectId,
    recurrence_rule: input.recurrenceRule,
  };
}
