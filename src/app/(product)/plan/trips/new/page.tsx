import { redirect } from "next/navigation";
import { requireCreationId } from "@/lib/projects/creation-id";
import { loadProject } from "@/lib/projects/queries";
import { saveProjectAction } from "@/app/(product)/plan/projects/actions";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";

export default async function NewTripPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  const id = requireCreationId((await searchParams).draft, "/plan/trips/new");
  if (await loadProject(id)) redirect(`/plan/projects/${id}`);
  return (
    <FormPage
      backHref="/plan/trips"
      title="Plan a trip"
      description="Start dreaming. You can add bookings, checklists, and expenses as you go."
    >
      <ProjectForm id={id} kind="trip" action={saveProjectAction} />
    </FormPage>
  );
}
