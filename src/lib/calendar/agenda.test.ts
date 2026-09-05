import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./context", () => ({
  calendarContext: vi.fn(),
  getConnectionSummary: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/domain/calendar/ical-read", async (original) => {
  const actual = await original<typeof import("@/domain/calendar/ical-read")>();
  return { ...actual, readCalendar: vi.fn(actual.readCalendar) };
});
import { calendarContext } from "./context";
import { readCalendar } from "@/domain/calendar/ical-read";
import { loadAgenda } from "./agenda";
it("parses each resource once when expanding a dense agenda series", async () => {
  const ical = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "BEGIN:VEVENT",
    "UID:dense@example",
    "SUMMARY:Stretch",
    "DTSTART:20260907T090000Z",
    "DTEND:20260907T090100Z",
    "RRULE:FREQ=MINUTELY;COUNT=200",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
  const events = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    range: vi.fn().mockResolvedValue({
      error: null,
      data: [
        {
          id: "dense",
          ical_data: ical,
          sync_state: "synced",
          attendance: "both",
        },
      ],
    }),
  };
  const members = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockResolvedValue({ error: null, data: [] }),
  };
  vi.mocked(calendarContext).mockResolvedValue({
    member: { householdId: "household" },
    db: {
      from: (table: string) => (table === "calendar_events" ? events : members),
    },
  } as unknown as Awaited<ReturnType<typeof calendarContext>>);
  const agenda = await loadAgenda("2026-09-07");
  expect(agenda.warnings).toEqual([]);
  expect(agenda.items).toHaveLength(200);
  expect(agenda.items.every((item) => item.recurring)).toBe(true);
  expect(readCalendar).toHaveBeenCalledTimes(1);
});
