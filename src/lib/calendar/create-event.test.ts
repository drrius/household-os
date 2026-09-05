import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("./context", () => ({ calendarContext: vi.fn() }));
import { calendarContext } from "./context";
import { insertCalendarEvent } from "./create-event";
const id = "11111111-1111-4111-8111-111111111111";
const values = {
  title: "Trip",
  starts_at: "2026-09-05T12:00:00Z",
  ends_at: "2026-09-05T13:00:00Z",
  ical_uid: `${id}@household-os`,
  ical_data: "new generated timestamp",
  cancelled_at: null,
  connection_id: null,
};
let prior: Record<string, unknown>;
beforeEach(() => {
  prior = {
    ...values,
    starts_at: "2026-09-05T12:00:00+00:00",
    ical_data: "old generated timestamp",
  };
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn(async () => ({ data: prior, error: null })),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn(async () => ({ data: null, error: { code: "23505" } })),
  };
  vi.mocked(calendarContext).mockResolvedValue({
    member: { householdId: id, userId: id },
    db: { from: () => query },
  } as unknown as Awaited<ReturnType<typeof calendarContext>>);
});
it("acknowledges identical creates despite timestamp formatting and generated ICS timestamp", async () => {
  expect(await insertCalendarEvent(values, id)).toBe(id);
});
it.each(["title", "connection_id", "cancelled_at", "ical_uid"])(
  "rejects a changed %s rather than overwriting",
  async (key) => {
    prior[key] = "changed";
    await expect(insertCalendarEvent(values, id)).rejects.toThrow(
      "already created and has changed",
    );
  },
);
it("rejects a hidden or missing collision", async () => {
  prior = {};
  await expect(insertCalendarEvent(values, id)).rejects.toThrow(
    "already created and has changed",
  );
});
