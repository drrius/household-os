import { requireCreationId } from "@/lib/projects/creation-id";
import { loadProjectTask } from "@/lib/projects/queries";
import { notFound, redirect } from "next/navigation";
import { saveProjectTaskAction } from "@/app/(product)/plan/projects/actions";
import { loadProject, loadProjectWork } from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectTaskForm } from "@/ui/projects/task-form.client";

export default async function NewProjectTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const { projectId } = await params;
  const project = await loadProject(projectId);
  if (!project || project.archived_at) notFound();
  const id = requireCreationId(
    (await searchParams).draft,
    `/plan/projects/${projectId}/tasks/new`,
  );
  if (await loadProjectTask(projectId, id))
    redirect(`/plan/projects/${projectId}#tasks`);
  const { members } = await loadProjectWork(projectId);
  return (
    <FormPage
      backHref={`/plan/projects/${projectId}`}
      title="Add task"
      description={project.title}
    >
      <ProjectTaskForm
        id={id}
        projectId={projectId}
        members={members}
        action={saveProjectTaskAction}
      />
    </FormPage>
  );
}
