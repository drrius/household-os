import { saveProjectAction } from "@/app/(product)/plan/projects/actions";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";

export default function NewProjectPage() {
  return (
    <FormPage
      backHref="/plan/projects"
      title="New project"
      description="Give it a name, then work out the next steps together."
    >
      <ProjectForm
        id={crypto.randomUUID()}
        kind="project"
        action={saveProjectAction}
      />
    </FormPage>
  );
}
