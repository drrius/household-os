import { saveProjectAction } from "@/app/(product)/plan/projects/actions";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";

export default function NewTripPage() {
  return (
    <FormPage
      backHref="/plan/trips"
      title="Plan a trip"
      description="Start dreaming. You can add bookings, checklists, and expenses as you go."
    >
      <ProjectForm
        id={crypto.randomUUID()}
        kind="trip"
        action={saveProjectAction}
      />
    </FormPage>
  );
}
