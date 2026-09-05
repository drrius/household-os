import { redirect } from "next/navigation";
import { requireCreationId } from "@/lib/projects/creation-id";
import { loadProject } from "@/lib/projects/queries";
import { saveProjectAction } from "@/app/(product)/plan/projects/actions";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const id = requireCreationId(
    (await searchParams).draft,
    "/plan/projects/new",
  );
  if (await loadProject(id)) redirect(`/plan/projects/${id}`);
  return (
    <FormPage
      backHref="/plan/projects"
      title="New project"
      description="Give it a name, then work out the next steps together."
    >
      <ProjectForm id={id} kind="project" action={saveProjectAction} />
    </FormPage>
  );
}
