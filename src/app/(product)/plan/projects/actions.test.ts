import { expect, it, vi } from "vitest";
import { redirect } from "next/navigation";

vi.mock("server-only", () => ({}));
const mocks = vi.hoisted(() => ({
  member: vi.fn(),
  save: vi.fn(),
  load: vi.fn(),
}));
vi.mock("@/lib/auth/member-context", () => ({
  requireMemberContext: mocks.member,
}));
vi.mock("@/lib/connected/records", () => ({
  saveHouseholdRecord: mocks.save,
  archiveHouseholdRecord: mocks.save,
}));
vi.mock("@/lib/projects/queries", () => ({
  loadProject: mocks.load,
  loadProjectTask: mocks.load,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  saveProjectAction,
  archiveProjectAction,
  saveProjectTaskAction,
  setProjectTaskStateAction,
} from "./actions";

it.each([
  saveProjectAction,
  archiveProjectAction,
  saveProjectTaskAction,
  setProjectTaskStateAction,
])(
  "lets expired-session redirects escape before form error handling: %s",
  async (action) => {
    vi.clearAllMocks();
    mocks.member.mockImplementation(() => redirect("/sign-in"));
    await expect(
      action({ submissionId: 0 }, new FormData()),
    ).rejects.toMatchObject({
      digest: expect.stringContaining("NEXT_REDIRECT;"),
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(mocks.load).not.toHaveBeenCalled();
  },
);

it("rejects edits to an archived project before issuing a write", async () => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({});
  mocks.load.mockResolvedValue({ archived_at: "2026-09-05T12:00:00Z" });
  const form = new FormData();
  form.set("id", "39000000-0000-4000-8000-000000000001");
  form.set("updatedAt", "2026-09-05T12:00:00Z");
  form.set("kind", "project");
  form.set("title", "Changed title");
  const result = await saveProjectAction({ submissionId: 0 }, form);
  expect(result.error).toBe("Restore this plan before editing its details.");
  expect(result.values?.title).toBe("Changed title");
  expect(mocks.save).not.toHaveBeenCalled();
});

it("retains search context when a successful task edit returns to its parent plan", async () => {
  vi.clearAllMocks();
  mocks.member.mockResolvedValue({});
  mocks.load.mockResolvedValue({ archived_at: null });
  mocks.save.mockResolvedValue({});
  const form = new FormData();
  const project = "39000000-0000-4000-8000-000000000001";
  form.set("id", "39000000-0000-4000-8000-000000000002");
  form.set("project_id", project);
  form.set("title", "Pack passports");
  form.set("updatedAt", "2026-09-05T12:00:00Z");
  form.set("searchReturn", "/search?q=passport&type=task");
  await expect(
    saveProjectTaskAction({ submissionId: 0 }, form),
  ).rejects.toMatchObject({
    digest: expect.stringContaining(
      `/plan/projects/${project}?fromSearch=%2Fsearch%3Fq%3Dpassport%26type%3Dtask#tasks`,
    ),
  });
  expect(mocks.save).toHaveBeenCalledTimes(1);
});
