import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { allDayBounds } from "@/domain/calendar/date-time";
import type { CalendarRow } from "@/lib/calendar/rows";
import { calendarDetails } from "./calendar-details";
const row: CalendarRow = {
  id: "event",
  household_id: "household",
  updated_at: "2026-09-05T10:00:00Z",
  title: "Holiday",
  starts_at: "2026-09-05T00:00:00Z",
  ends_at: "2026-09-07T00:00:00Z",
  time_zone: "Europe/Zurich",
  all_day: true,
  attendance: "both",
  attending_member_id: null,
  location: "",
  notes: "",
  project_id: null,
  recurrence_rule: null,
  cancelled_at: null,
  ical_uid: "PRIVATE-UID",
  ical_data: null,
  ical_edit_base: null,
  connection_id: null,
  remote_href: "PRIVATE-URL",
  remote_etag: null,
  sync_state: "local",
  last_synced_ical: null,
  remote_conflict_ical: null,
  remote_conflict_etag: null,
  last_sync_error: null,
};
describe("calendar assistant edit values", () => {
  it("returns inclusive all-day dates for the existing save form", () => {
    expect(calendarDetails(row).edit).toMatchObject({
      fields: { start: "2026-09-05", end: "2026-09-06", allDay: true },
    });
  });
  it("round trips all-day ranges without adding or losing a day", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 27 }),
        fc.integer({ min: 0, max: 3 }),
        (start, length) => {
          const first = `2026-09-${String(start).padStart(2, "0")}`;
          const last = `2026-09-${String(start + length).padStart(2, "0")}`;
          const bounds = allDayBounds(first, last);
          const result = calendarDetails({
            ...row,
            starts_at: bounds.startsAt,
            ends_at: bounds.endsAt,
          });
          expect(result.edit).toMatchObject({
            fields: { start: first, end: last },
          });
        },
      ),
    );
  });
  it("converts timed instants into their event zone", () => {
    expect(
      calendarDetails({
        ...row,
        all_day: false,
        starts_at: "2026-09-05T10:00:00Z",
        ends_at: "2026-09-05T11:00:00Z",
      }).edit,
    ).toMatchObject({
      fields: { start: "2026-09-05T12:00", end: "2026-09-05T13:00" },
    });
  });
  it("distinguishes remote deletion from a malformed remote event", () => {
    expect(
      calendarDetails({ ...row, sync_state: "conflict" }).remoteConflict,
    ).toEqual({ deleted: true });
    const invalid = calendarDetails({
      ...row,
      sync_state: "conflict",
      remote_conflict_ical: "PRIVATE-BAD-DATA",
    });
    expect(invalid.remoteConflict).toHaveProperty("issue");
    expect(JSON.stringify(invalid)).not.toContain("PRIVATE");
  });
});
