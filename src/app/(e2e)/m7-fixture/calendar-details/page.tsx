import { notFound } from "next/navigation";
import { calendarTimePresentation } from "@/domain/calendar/presentation";
import type { CalendarEventInput } from "@/domain/calendar/types";
import {
  calendarInputForDisplay,
  rowFields,
  type CalendarRow,
} from "@/lib/calendar/rows";
import { AppShell } from "@/ui/shell/app-shell";
import { EventDetail } from "@/ui/calendar/event-detail";
export default async function CalendarDetailsFixture({
  searchParams,
}: {
  searchParams: Promise<{ surface?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { surface } = await searchParams;
  const input: CalendarEventInput = {
    title: surface === "all-day" ? "Three days by the lake" : "Time together",
    startsAt:
      surface === "all-day" ? "2026-09-07T00:00:00Z" : "2026-09-07T08:00:00Z",
    endsAt:
      surface === "all-day" ? "2026-09-10T00:00:00Z" : "2026-09-07T10:30:00Z",
    timeZone: surface === "custom" ? "Custom/Fixed" : "Europe/Zurich",
    allDay: surface === "all-day",
    attendance: "both",
    attendingMemberId: null,
    location: "By the lake",
    notes: "Bring a picnic.",
    projectId: null,
    recurrenceRule: null,
  };
  const row: CalendarRow = {
    ...rowFields(input),
    id: "00000000-0000-4000-8000-000000000001",
    household_id: "00000000-0000-4000-8000-000000000002",
    updated_at: "2026-09-01",
    cancelled_at: null,
    ical_uid: "fixture@example",
    ical_data: null,
    ical_edit_base: null,
    connection_id: null,
    remote_href: null,
    remote_etag: null,
    sync_state: "local",
    last_synced_ical: null,
    remote_conflict_ical: null,
    remote_conflict_etag: null,
    last_sync_error: null,
  };
  if (surface === "custom")
    row.ical_data = [
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
      "UID:fixture@example",
      "DTSTART;TZID=Custom/Fixed:20260907T100000",
      "DTEND;TZID=Custom/Fixed:20260907T123000",
      "SUMMARY:Time together",
      "END:VEVENT",
      "END:VCALENDAR",
      "",
    ].join("\r\n");
  const display = calendarInputForDisplay(row);
  return (
    <AppShell>
      <EventDetail
        input={display}
        row={row}
        connection={null}
        issue=""
        editable={false}
        recurring={false}
        memberName={null}
        {...calendarTimePresentation(display)}
      />
    </AppShell>
  );
}
