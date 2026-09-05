import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  event: vi.fn(),
  context: vi.fn(),
  connection: vi.fn(),
  update: vi.fn(),
}));
vi.mock("./context", () => ({
  getCalendarEvent: mock.event,
  calendarContext: mock.context,
  getConnectionSummary: mock.connection,
}));
import { resolveCalendarConflict } from "./commands";
beforeEach(() => {
  vi.clearAllMocks();
  const query = {
    update: mock.update,
    eq: () => query,
    select: () => query,
    maybeSingle: async () => ({ data: { id: "event" }, error: null }),
  };
  mock.update.mockReturnValue(query);
  mock.context.mockResolvedValue({
    db: { from: () => query },
    member: { householdId: "household" },
  });
  mock.event.mockResolvedValue({
    id: "event",
    sync_state: "conflict",
    remote_conflict_ical: "",
    ical_data: "existing",
    remote_conflict_etag: null,
  });
  mock.connection.mockResolvedValue({ read_only: false });
});
it.each(
  [[], ["unexpected"], [""], ["local", "remote"]].map((choices) => ({
    choices,
  })),
)(
  "rejects ambiguous or invalid conflict choices without saving: %j",
  async ({ choices }) => {
    const form = new FormData();
    form.set("id", "55000000-0000-4000-8000-000000000001");
    for (const choice of choices) form.append("choice", choice);
    await expect(resolveCalendarConflict(form)).rejects.toThrow(
      /Choose.*version/,
    );
    expect(mock.context).not.toHaveBeenCalled();
  },
);

it.each(["local", "remote"])(
  "accepts the explicit %s conflict decision",
  async (choice) => {
    const form = new FormData();
    form.set("id", "55000000-0000-4000-8000-000000000001");
    form.set("choice", choice);
    await resolveCalendarConflict(form);
    expect(mock.update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_state: choice === "remote" ? "synced" : "pending",
        remote_conflict_ical: null,
      }),
    );
  },
);
