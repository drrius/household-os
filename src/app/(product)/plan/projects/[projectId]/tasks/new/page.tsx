import { notFound } from "next/navigation";
import { saveProjectTaskAction } from "@/app/(product)/plan/projects/actions";
import { loadProject, loadProjectWork } from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectTaskForm } from "@/ui/projects/task-form.client";

export default async function NewProjectTaskPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await loadProject(projectId);
  if (!project || project.archived_at) notFound();
  const { members } = await loadProjectWork(projectId);
  return (
    <FormPage
      backHref={`/plan/projects/${projectId}`}
      title="Add task"
      description={project.title}
    >
      <ProjectTaskForm
        id={crypto.randomUUID()}
        projectId={projectId}
        members={members}
        action={saveProjectTaskAction}
      />
    </FormPage>
  );
}
