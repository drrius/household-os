import "server-only";
import { startersFor } from "@/domain/projects/starters";
import { loadProjectTask, loadProject } from "@/lib/projects/queries";
import { loadProjectActivity } from "@/lib/projects/activity";
import { projectDetailSchemas as schemas } from "./definitions/project-detail-tools";
export async function readProjectDetail(
  name: string,
  input: unknown,
): Promise<Record<string, unknown>> {
  if (name === "get_project_starters")
    return {
      starters: startersFor(schemas.get_project_starters.parse(input).kind),
    };
  if (name === "get_project_task") {
    const { projectId, taskId } = schemas.get_project_task.parse(input);
    const task = await loadProjectTask(projectId, taskId);
    if (!task) throw new Error("This task is unavailable.");
    return { task };
  }
  const { projectId, page } = schemas.get_project_activity.parse(input);
  if (!(await loadProject(projectId)))
    throw new Error("This plan is unavailable.");
  return loadProjectActivity(projectId, page);
}
