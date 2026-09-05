import { notFound } from "next/navigation";
import {
  saveProjectTaskAction,
  setProjectTaskStateAction,
} from "@/app/(product)/plan/projects/actions";
import {
  loadProject,
  loadProjectTask,
  loadProjectWork,
} from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectTaskForm } from "@/ui/projects/task-form.client";
import { RecordAction } from "@/ui/projects/record-action.client";

export default async function ProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string; taskId: string }>;
}) {
  const { projectId, taskId } = await params;
  const [project, task] = await Promise.all([
    loadProject(projectId),
    loadProjectTask(projectId, taskId),
  ]);
  if (!project || !task) notFound();
  const { members } = await loadProjectWork(projectId);
  const readOnly = Boolean(project.archived_at || task.archived_at);
  return (
    <FormPage
      backHref={`/plan/projects/${projectId}`}
      title="Task details"
      description={project.title}
    >
      {readOnly && (
        <p className="mb-4 rounded-xl border p-4 text-sm">
          {project.archived_at
            ? "Restore this plan to change its tasks."
            : "This task was removed. Restore it to make changes."}
        </p>
      )}
      <fieldset disabled={readOnly} className="min-w-0 disabled:opacity-70">
        <ProjectTaskForm
          id={taskId}
          projectId={projectId}
          task={task}
          members={members}
          action={saveProjectTaskAction}
        />
      </fieldset>
      {!project.archived_at && (
        <details className="mt-6 border-t pt-4">
          <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
            {task.archived_at
              ? "Restore to this checklist"
              : "Remove from this checklist"}
          </summary>
          <div className="mt-3">
            <RecordAction
              action={setProjectTaskStateAction}
              fields={{
                id: task.id,
                project_id: projectId,
                updatedAt: task.updated_at,
                operation: task.archived_at ? "restore" : "archive",
              }}
              label={task.archived_at ? "Restore task" : "Remove task"}
            />
          </div>
        </details>
      )}
    </FormPage>
  );
}
