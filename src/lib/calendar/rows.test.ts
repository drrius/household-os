import { expect, it } from "vitest";
import { calendarInputForDisplay, rowFields, type CalendarRow } from "./rows";
const ical = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VTIMEZONE",
  "TZID:Custom/Fixed",
  "BEGIN:STANDARD",
  "DTSTART:19700101T000000",
  "TZOFFSETFROM:+0200",
  "TZOFFSETTO:+0200",
  "END:STANDARD",
  "END:VTIMEZONE",
  "BEGIN:VEVENT",
  "UID:custom@example",
  "DTSTART;TZID=Custom/Fixed:20260901T100000",
  "DTEND;TZID=Custom/Fixed:20260901T110000",
  "SUMMARY:Original custom plan",
  "END:VEVENT",
  "END:VCALENDAR",
  "",
].join("\r\n");
const row: CalendarRow = {
  id: "event",
  household_id: "household",
  updated_at: "version",
  title: "Original custom plan",
  starts_at: "2026-09-01T08:00:00Z",
  ends_at: "2026-09-01T09:00:00Z",
  time_zone: "UTC",
  all_day: false,
  attendance: "one",
  attending_member_id: "member",
  location: "",
  notes: "",
  project_id: "project",
  recurrence_rule: null,
  cancelled_at: null,
  ical_uid: "custom@example",
  ical_data: ical,
  ical_edit_base: null,
  connection_id: "connection",
  remote_href: "event.ics",
  remote_etag: "one",
  sync_state: "synced",
  last_synced_ical: ical,
  remote_conflict_ical: null,
  remote_conflict_etag: null,
  last_sync_error: null,
};
it("derives custom master display from original ICS and keeps household attendance/project", () => {
  const display = calendarInputForDisplay(row);
  expect(display).toMatchObject({
    title: "Original custom plan",
    timeZone: "Custom/Fixed",
    startsAt: "2026-09-01T08:00:00.000Z",
    attendance: "one",
    attendingMemberId: "member",
    projectId: "project",
  });
  expect(rowFields(display).time_zone).toBe("UTC");
  expect(row.ical_data).toBe(ical);
});
it("shows pending local fields when no canonical ICS exists yet", () => {
  expect(
    calendarInputForDisplay({
      ...row,
      ical_data: null,
      title: "Changed",
      time_zone: "Europe/Zurich",
    }),
  ).toMatchObject({ title: "Changed", timeZone: "Europe/Zurich" });
});
