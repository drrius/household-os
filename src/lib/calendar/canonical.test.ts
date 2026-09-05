import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { canonicalCalendar } from "./canonical";
import { masterFromIcal } from "@/domain/calendar/ical-read";
import { writeCalendar } from "@/domain/calendar/ical-write";
import type { CalendarRow } from "./rows";
it("rebuilds linked booking edits without discarding unsynced calendar details", () => {
  const base = writeCalendar(
    {
      title: "Before",
      startsAt: "2026-09-07T10:00:00Z",
      endsAt: "2026-09-07T11:00:00Z",
      timeZone: "UTC",
      allDay: false,
      attendance: "both",
      attendingMemberId: null,
      location: "",
      notes: "Keep this note",
      projectId: null,
      recurrenceRule: null,
    },
    { uid: "booking@example" },
  ).replace("BEGIN:VEVENT", "BEGIN:VEVENT\r\nX-APPLE-TRAVEL-DURATION:PT30M");
  const row = {
    id: "event",
    household_id: "household",
    updated_at: "2026-09-01",
    title: "New departure",
    starts_at: "2026-09-08T09:00:00Z",
    ends_at: "2026-09-08T10:00:00Z",
    time_zone: "UTC",
    all_day: false,
    attendance: "both",
    attending_member_id: null,
    location: "Airport",
    notes: "Keep this note",
    project_id: null,
    recurrence_rule: null,
    cancelled_at: null,
    ical_uid: "booking@example",
    ical_data: null,
    ical_edit_base: base,
    connection_id: "connection",
    remote_href: null,
    remote_etag: null,
    sync_state: "pending",
    last_synced_ical: null,
    remote_conflict_ical: null,
    remote_conflict_etag: null,
    last_sync_error: null,
  } satisfies CalendarRow;
  const result = canonicalCalendar(row);
  expect(masterFromIcal(result)).toMatchObject({
    title: "New departure",
    startsAt: "2026-09-08T09:00:00.000Z",
    location: "Airport",
  });
  expect(result).toContain("X-APPLE-TRAVEL-DURATION:PT30M");
});
