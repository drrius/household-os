import { notFound } from "next/navigation";
import { saveProjectAction } from "@/app/(product)/plan/projects/actions";
import { loadProject } from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const project = await loadProject(projectId);
  if (!project || project.archived_at) notFound();
  return (
    <FormPage
      backHref={`/plan/projects/${projectId}`}
      title="Edit plan"
      description="Keep the details up to date for both of you."
    >
      <ProjectForm
        id={projectId}
        kind={project.kind}
        project={project}
        action={saveProjectAction}
      />
    </FormPage>
  );
}
