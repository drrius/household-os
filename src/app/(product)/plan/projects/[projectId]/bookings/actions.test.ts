import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const mock = vi.hoisted(() => ({
  member: vi.fn(),
  project: vi.fn(),
  booking: vi.fn(),
  save: vi.fn(),
  archive: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mock.member,
}));
vi.mock("@/lib/projects/queries", () => ({ loadProject: mock.project }));
vi.mock("@/lib/trips/queries", () => ({ loadBooking: mock.booking }));
vi.mock("@/lib/trips/commands", () => ({
  saveBooking: mock.save,
  archiveBooking: mock.archive,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/navigation")>()),
  redirect: vi.fn((url: string) => {
    throw new Error("redirect:" + url);
  }),
}));
import { saveBookingAction, archiveBookingAction } from "./actions";
const id = "36000000-0000-4000-8000-000000000020";
const previous = { submissionId: 0 };
function form() {
  const result = new FormData();
  Object.entries({
    id,
    project_id: id,
    title: "Flight",
    kind: "flight",
    time_zone: "Europe/Zurich",
    end_time_zone: "Europe/Zurich",
  }).forEach(([k, v]) => result.set(k, v));
  return result;
}
beforeEach(() => {
  vi.resetAllMocks();
  mock.member.mockResolvedValue({ householdId: "household", userId: "member" });
  mock.project.mockResolvedValue({ id, kind: "trip", archived_at: null });
});
it.each([saveBookingAction, archiveBookingAction])(
  "lets expired-session redirects escape form-error handling",
  async (action) => {
    const expired = Object.assign(new Error("NEXT_REDIRECT"), {
      digest: "NEXT_REDIRECT;replace;/sign-in;307;",
    });
    mock.member.mockRejectedValue(expired);
    await expect(action(previous, form())).rejects.toBe(expired);
    expect(mock.project).not.toHaveBeenCalled();
    expect(mock.save).not.toHaveBeenCalled();
    expect(mock.archive).not.toHaveBeenCalled();
  },
);
it.each([
  null,
  { id, kind: "project", archived_at: null },
  { id, kind: "trip", archived_at: "archived" },
])(
  "rejects unavailable and non-trip parents before persisting",
  async (project) => {
    mock.project.mockResolvedValue(project);
    const result = await saveBookingAction(previous, form());
    expect(result.error).toContain("active trip");
    expect(mock.save).not.toHaveBeenCalled();
  },
);
it("requires a version and a valid archive operation", async () => {
  const input = form();
  input.set("archived", "true");
  expect((await archiveBookingAction(previous, input)).error).toContain(
    "Reload",
  );
  input.set("updatedAt", "2026-09-05T00:00:00Z");
  input.set("archived", "other");
  expect((await archiveBookingAction(previous, input)).error).toContain(
    "valid booking action",
  );
  expect(mock.archive).not.toHaveBeenCalled();
});
