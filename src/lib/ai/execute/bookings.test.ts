import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/member-context", () => ({ requireMemberContext: vi.fn() }));
vi.mock("@/lib/projects/queries", () => ({ loadProject: vi.fn() }));
vi.mock("@/lib/trips/queries", () => ({ loadBooking: vi.fn() }));
vi.mock("@/lib/trips/commands", () => ({
  saveBooking: vi.fn(),
  archiveBooking: vi.fn(),
}));
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadProject } from "@/lib/projects/queries";
import { saveBooking } from "@/lib/trips/commands";
import { BOOKING_HANDLERS } from "./bookings";
const id = "11111111-1111-4111-8111-111111111111";
const context = {
  idempotencyKey: "ai:save_trip_booking:one",
  today: "2026-09-05",
};
const fields = {
  project_id: id,
  kind: "flight",
  title: "Flight",
  starts_at: "2026-10-25T02:30",
  ends_at: "2026-10-25T04:30",
  time_zone: "Europe/Zurich",
  end_time_zone: "Europe/Zurich",
  start_clock: "later",
  estimateCents: 12345,
};
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(requireMemberContext).mockResolvedValue({
    householdId: id,
  } as Awaited<ReturnType<typeof requireMemberContext>>);
  vi.mocked(loadProject).mockResolvedValue({
    id,
    kind: "trip",
    archived_at: null,
  } as Awaited<ReturnType<typeof loadProject>>);
});
it("preserves explicit repeated-time choice, centimes and retry identity", async () => {
  const input = { identity: { mode: "create" }, fields };
  const first = await BOOKING_HANDLERS.save_trip_booking!(input, context);
  expect(await BOOKING_HANDLERS.save_trip_booking!(input, context)).toEqual(
    first,
  );
  expect(vi.mocked(saveBooking).mock.calls[0]![0]).toMatchObject({
    version: null,
    fields: {
      starts_at: "2026-10-25T01:30:00Z",
      estimated_amount_cents: 12345,
    },
  });
  expect(vi.mocked(saveBooking).mock.calls[1]![0].id).toBe(
    vi.mocked(saveBooking).mock.calls[0]![0].id,
  );
});
it("rejects an ambiguous time without a choice before any write", async () => {
  await expect(
    BOOKING_HANDLERS.save_trip_booking!(
      {
        identity: { mode: "create" },
        fields: { ...fields, start_clock: "reject" },
      },
      context,
    ),
  ).rejects.toThrow("clock change");
  expect(saveBooking).not.toHaveBeenCalled();
});
it("rejects a non-trip parent before any write", async () => {
  vi.mocked(loadProject).mockResolvedValue({
    id,
    kind: "project",
    archived_at: null,
  } as Awaited<ReturnType<typeof loadProject>>);
  await expect(
    BOOKING_HANDLERS.save_trip_booking!(
      { identity: { mode: "create" }, fields },
      context,
    ),
  ).rejects.toThrow("active trip");
  expect(saveBooking).not.toHaveBeenCalled();
});
it("cannot use the same invocation to create the same ID in another household", async () => {
  const first = await BOOKING_HANDLERS.save_trip_booking!(
    { identity: { mode: "create" }, fields },
    context,
  );
  vi.mocked(requireMemberContext).mockResolvedValue({
    householdId: "22222222-2222-4222-8222-222222222222",
  } as Awaited<ReturnType<typeof requireMemberContext>>);
  expect(
    await BOOKING_HANDLERS.save_trip_booking!(
      { identity: { mode: "create" }, fields },
      context,
    ),
  ).not.toEqual(first);
});
