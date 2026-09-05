import { beforeEach, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
const reads = vi.hoisted(() => ({
  project: vi.fn(),
  task: vi.fn(),
  work: vi.fn(),
}));
vi.mock("@/lib/projects/queries", () => ({
  loadProject: reads.project,
  loadProjectTask: reads.task,
  loadProjectWork: reads.work,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import NewProjectPage from "@/app/(product)/plan/projects/new/page";
import NewTripPage from "@/app/(product)/plan/trips/new/page";
import NewTaskPage from "@/app/(product)/plan/projects/[projectId]/tasks/new/page";
const id = "39000000-0000-4000-8000-000000000039";
beforeEach(() => vi.resetAllMocks());
it.each([NewProjectPage, NewTripPage])(
  "opens an already-created plan when its creation URL is reloaded",
  async (page) => {
    reads.project.mockResolvedValue({ id, archived_at: null });
    await expect(
      page({ searchParams: Promise.resolve({ draft: id }) }),
    ).rejects.toMatchObject({
      digest: expect.stringContaining(`/plan/projects/${id};`),
    });
    expect(reads.project).toHaveBeenCalledWith(id);
  },
);
it("returns to the checklist when the task already exists after an uncertain save", async () => {
  const projectId = "39000000-0000-4000-8000-000000000040";
  reads.project.mockResolvedValue({ id: projectId, archived_at: null });
  reads.task.mockResolvedValue({ id });
  await expect(
    NewTaskPage({
      params: Promise.resolve({ projectId }),
      searchParams: Promise.resolve({ draft: id }),
    }),
  ).rejects.toMatchObject({
    digest: expect.stringContaining(`/plan/projects/${projectId}#tasks;`),
  });
  expect(reads.task).toHaveBeenCalledWith(projectId, id);
  expect(reads.work).not.toHaveBeenCalled();
});
