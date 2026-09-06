import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  push: vi.fn(),
  read: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("./push", () => ({ pushCalendarEvent: mock.push }));
vi.mock("./caldav", () => ({ readAppleCalendar: mock.read }));
vi.mock("./credentials", () => ({
  decryptCredentials: () => ({ username: "test", password: "test" }),
}));
vi.mock("./connection", () => ({
  getPrivateConnection: async () => ({
    id: "connection",
    household_id: "household",
    encrypted_credentials: "fixture",
    selected_calendar_url: "https://caldav.icloud.com/shared/",
    read_only: false,
  }),
}));
vi.mock("./context", () => ({
  calendarContext: async () => ({ db: { from: mock.from, rpc: mock.rpc } }),
}));
import { syncAppleCalendar } from "./sync";
import { CalendarError } from "./errors";
function pending(count: number) {
  const rows = Array.from({ length: count }, (_, i) => ({ id: `event-${i}` }));
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: rows, error: null }),
    in: async () => ({ count: 0, error: null }),
  };
  mock.from.mockReturnValue(query);
}
beforeEach(() => {
  vi.clearAllMocks();
  mock.read.mockResolvedValue([]);
  mock.push.mockResolvedValue(undefined);
  mock.rpc.mockImplementation(async (name: string) => ({
    data: name === "claim_calendar_sync" ? "lease" : null,
    error: null,
  }));
});
it("sends later events after an individual failure and releases the lease with the failure", async () => {
  pending(3);
  const failure = new CalendarError(
    "invalid",
    "Check the first event in Apple Calendar.",
  );
  mock.push.mockRejectedValueOnce(failure);
  await expect(syncAppleCalendar()).rejects.toBe(failure);
  expect(mock.push.mock.calls.map((call) => call[5].id)).toEqual([
    "event-0",
    "event-1",
    "event-2",
  ]);
  expect(mock.rpc).toHaveBeenLastCalledWith("release_calendar_sync", {
    p_connection_id: "connection",
    p_token: "lease",
    p_error: failure.message,
  });
});
it("keeps the batch bounded even when every event fails", async () => {
  pending(21);
  mock.push.mockRejectedValue(new CalendarError("network", "Retry later."));
  await expect(syncAppleCalendar()).rejects.toThrow("Retry later.");
  expect(mock.push).toHaveBeenCalledTimes(20);
});
it("releases successful sync without a failure and reports further batches", async () => {
  pending(2);
  await expect(syncAppleCalendar()).resolves.toBeUndefined();
  expect(mock.rpc).toHaveBeenLastCalledWith("release_calendar_sync", {
    p_connection_id: "connection",
    p_token: "lease",
    p_error: null,
  });
  pending(21);
  await expect(syncAppleCalendar()).rejects.toThrow("More changes are waiting");
});

it("does not reconcile or push when listing validation fails and retains the diagnostic", async () => {
  const failure = new CalendarError(
    "invalid",
    "Incomplete listing. Diagnostic: S200/P404/Emissing/Dmissing/C1.",
  );
  mock.read.mockRejectedValue(failure);
  await expect(syncAppleCalendar()).rejects.toBe(failure);
  expect(mock.rpc.mock.calls.map(([name]) => name)).toEqual([
    "claim_calendar_sync",
    "release_calendar_sync",
  ]);
  expect(mock.push).not.toHaveBeenCalled();
  expect(mock.rpc).toHaveBeenLastCalledWith("release_calendar_sync", {
    p_connection_id: "connection",
    p_token: "lease",
    p_error: failure.message,
  });
});
