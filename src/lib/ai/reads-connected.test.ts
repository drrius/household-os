import { calendarWeek } from "@/domain/calendar/date-time";
import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/projects/queries", () => ({
  loadProject: vi.fn(),
  loadProjects: vi.fn(),
  loadProjectWork: vi.fn(),
}));
vi.mock("@/lib/trips/queries", () => ({
  loadBooking: vi.fn(),
  loadBookings: vi.fn(),
}));
vi.mock("@/lib/home-records/read", () => ({
  listRecords: vi.fn(),
  readRecord: vi.fn(),
}));
vi.mock("@/lib/search/read", () => ({ loadHouseholdSearch: vi.fn() }));
vi.mock("@/lib/calendar/agenda", () => ({ loadAgenda: vi.fn() }));
vi.mock("@/lib/calendar/context", () => ({
  getCalendarEvent: vi.fn(),
  getConnectionSummary: vi.fn(),
}));
import { getCalendarEvent, getConnectionSummary } from "@/lib/calendar/context";
import { loadAgenda } from "@/lib/calendar/agenda";
import { loadProject } from "@/lib/projects/queries";
import { readConnectedTool } from "./reads-connected";
import { connectedReadSchemas } from "./definitions/connected-read-tools";
const id = "11111111-1111-4111-8111-111111111111";

beforeEach(() => vi.resetAllMocks());
describe("connected assistant reads", () => {
  it("omits calendar transport snapshots and remote URLs", async () => {
    vi.mocked(getCalendarEvent).mockResolvedValue({
      id,
      title: "Flight",
      updated_at: "2026-09-05T10:00:00Z",
      sync_state: "conflict",
      remote_href: "PRIVATE-REMOTE",
      remote_conflict_ical: "PRIVATE-ICAL",
      last_synced_ical: "PRIVATE-SNAPSHOT",
    } as Awaited<ReturnType<typeof getCalendarEvent>>);
    const result = await readConnectedTool("get_calendar_event", {
      eventId: id,
    });
    expect(result.event).toMatchObject({
      id,
      title: "Flight",
      updated_at: "2026-09-05T10:00:00Z",
      sync_state: "conflict",
    });
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("reports connection attention without exposing diagnostic or URL contents", async () => {
    vi.mocked(getConnectionSummary).mockResolvedValue({
      id,
      calendar_name: "Our calendar",
      selected_calendar_url: "PRIVATE-URL",
      read_only: false,
      last_synced_at: null,
      last_error: "PRIVATE-DIAGNOSTIC",
    });
    expect(await readConnectedTool("get_calendar_connection", {})).toEqual({
      connection: {
        id,
        calendarName: "Our calendar",
        readOnly: false,
        lastSyncedAt: null,
        needsAttention: true,
      },
      setupPath: "/home/calendar",
    });
  });
  it("keeps calendar attention actionable without raw connection diagnostics", async () => {
    vi.mocked(loadAgenda).mockResolvedValue({
      week: calendarWeek("2026-09-07"),
      items: [],
      cancelled: [],
      warnings: [],
      attention: [
        { id, title: "Flight", state: "conflict", error: "PRIVATE-DIAGNOSTIC" },
      ],
      connection: {
        id,
        calendar_name: "Calendar",
        read_only: false,
        last_synced_at: null,
        last_error: null,
        selected_calendar_url: "PRIVATE-URL",
      },
    } as Awaited<ReturnType<typeof loadAgenda>>);
    const result = await readConnectedTool("get_calendar_agenda", {});
    expect(result.attention).toEqual([
      { id, title: "Flight", syncState: "conflict" },
    ]);
    expect(JSON.stringify(result)).not.toContain("PRIVATE");
  });
  it("rejects an unavailable project instead of presenting empty editable data", async () => {
    vi.mocked(loadProject).mockResolvedValue(null);
    await expect(
      readConnectedTool("get_project", { projectId: id }),
    ).rejects.toThrow("no longer available");
  });
  it.each([-1, 0.5, 10001, Infinity])(
    "rejects invalid pagination %s",
    (page) => {
      expect(
        connectedReadSchemas.get_home_records.safeParse({
          kind: "inventory",
          page,
        }).success,
      ).toBe(false);
      expect(
        connectedReadSchemas.get_projects.safeParse({ kind: "trip", page })
          .success,
      ).toBe(false);
    },
  );
});
