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
