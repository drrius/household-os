import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { pushCalendarEvent } from "./push";
import { CalendarError } from "./errors";
import { writeCalendar } from "@/domain/calendar/ical-write";
import type { CalendarRow } from "./rows";
const url = "https://p01-caldav.icloud.com/123/calendars/shared/";
const ical = writeCalendar(
  {
    title: "Plan",
    startsAt: "2026-09-01T09:00:00Z",
    endsAt: "2026-09-01T10:00:00Z",
    timeZone: "UTC",
    allDay: false,
    attendance: "both",
    attendingMemberId: null,
    location: "",
    notes: "",
    projectId: null,
    recurrenceRule: null,
  },
  { uid: "plan@example" },
);
const row: CalendarRow = {
  id: "event",
  household_id: "household",
  updated_at: "2026-09-01",
  title: "Plan",
  starts_at: "2026-09-01T09:00:00Z",
  ends_at: "2026-09-01T10:00:00Z",
  time_zone: "UTC",
  all_day: false,
  attendance: "both",
  attending_member_id: null,
  location: "",
  notes: "",
  project_id: null,
  recurrence_rule: null,
  cancelled_at: null,
  ical_uid: "plan@example",
  ical_data: ical,
  ical_edit_base: null,
  connection_id: "connection",
  remote_href: `${url}event.ics`,
  remote_etag: '"one"',
  sync_state: "pending",
  last_synced_ical: ical,
  remote_conflict_ical: null,
  remote_conflict_etag: null,
  last_sync_error: null,
};
function harness() {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const db = { rpc } as unknown as Parameters<typeof pushCalendarEvent>[0];
  const transport = vi
    .fn()
    .mockResolvedValue({ status: 204, etag: '"two"', body: "", url });
  return { db, rpc, transport };
}
it.each([
  "not a calendar",
  ical.replace(
    "BEGIN:VEVENT",
    "BEGIN:VEVENT\r\nATTENDEE:mailto:guest@example.com",
  ),
  ical.replace("plan@example", "wrong@example"),
])("makes zero network writes for untrusted invalid ICS", async (payload) => {
  const { db, rpc, transport } = harness();
  await expect(
    pushCalendarEvent(
      db,
      transport,
      "connection",
      url,
      "token",
      { ...row, ical_data: payload },
      [{ href: row.remote_href!, etag: row.remote_etag!, ical }],
    ),
  ).rejects.toThrow("safely sent");
  expect(transport).not.toHaveBeenCalled();
  expect(rpc).not.toHaveBeenCalled();
});
it.each([false, true])(
  "does not overwrite or cancel a remote invitation whose local metadata was stripped (cancel=%s)",
  async (cancel) => {
    const { db, rpc, transport } = harness();
    const invitation = ical.replace(
      "BEGIN:VEVENT",
      "BEGIN:VEVENT\r\nORGANIZER:mailto:guest@example.com",
    );
    await expect(
      pushCalendarEvent(
        db,
        transport,
        "connection",
        url,
        "token",
        { ...row, cancelled_at: cancel ? "2026-09-01" : null },
        [{ href: row.remote_href!, etag: row.remote_etag!, ical: invitation }],
      ),
    ).rejects.toThrow("safely sent");
    expect(transport).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  },
);
it("rejects forged remote identities and versions before PUT", async () => {
  for (const remote of [
    { href: row.remote_href!, etag: '"other"', ical },
    {
      href: row.remote_href!,
      etag: row.remote_etag!,
      ical: ical.replace("plan@example", "other@example"),
    },
  ]) {
    const { db, transport } = harness();
    await expect(
      pushCalendarEvent(db, transport, "connection", url, "token", row, [
        remote,
      ]),
    ).rejects.toThrow();
    expect(transport).not.toHaveBeenCalled();
  }
});
it("sends a validated event with its fetched ETag and records that exact payload", async () => {
  const { db, rpc, transport } = harness();
  await pushCalendarEvent(db, transport, "connection", url, "token", row, [
    { href: row.remote_href!, etag: row.remote_etag!, ical },
  ]);
  expect(transport).toHaveBeenCalledWith(
    expect.objectContaining({
      method: "PUT",
      body: ical,
      headers: { "If-Match": '"one"' },
    }),
  );
  expect(rpc).toHaveBeenCalledWith(
    "record_calendar_push",
    expect.objectContaining({ p_sent_ical: ical, p_etag: '"two"' }),
  );
});

it.each(["network", "acknowledgement"])(
  "records %s failures against the prepared version without replacing a later edit",
  async (failure) => {
    const { rpc, transport } = harness();
    const prepared = { ...row, updated_at: "prepared-version" };
    const chain = {
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: prepared, error: null }),
    };
    const from = vi.fn().mockReturnValue(chain);
    const db = { rpc, from } as unknown as Parameters<
      typeof pushCalendarEvent
    >[0];
    if (failure === "network")
      transport.mockRejectedValue(
        new CalendarError("network", "Apple is unavailable. Retry sync."),
      );
    else rpc.mockResolvedValue({ error: { message: "lease expired" } });
    await expect(
      pushCalendarEvent(
        db,
        transport,
        "connection",
        url,
        "token",
        {
          ...row,
          ical_data: null,
        },
        [{ href: row.remote_href!, etag: row.remote_etag!, ical }],
      ),
    ).rejects.toThrow(
      failure === "network"
        ? "Apple is unavailable"
        : "local confirmation failed",
    );
    expect(chain.update.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({ ical_data: expect.any(String) }),
    );
    expect(chain.update.mock.calls[1]?.[0]).toEqual({
      last_sync_error: expect.stringContaining(
        failure === "network"
          ? "Apple is unavailable"
          : "local confirmation failed",
      ),
    });
    expect(chain.eq.mock.calls.slice(-4)).toEqual([
      ["id", row.id],
      ["household_id", row.household_id],
      ["updated_at", "prepared-version"],
      ["sync_state", "pending"],
    ]);
  },
);
