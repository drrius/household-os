import { bookingBack } from "@/lib/trips/navigation";
import { notFound } from "next/navigation";
import { loadProject } from "@/lib/projects/queries";
import { FormPage } from "@/ui/forms/form-page";
import { BookingForm } from "@/ui/trips/booking-form.client";
import { saveBookingAction } from "../actions";
export default async function NewBookingPage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const back = bookingBack(projectId, (await searchParams).back);
  const project = await loadProject(projectId);
  if (!project || project.kind !== "trip" || project.archived_at) notFound();
  return (
    <FormPage title="Add booking" description={project.title} backHref={back}>
      <BookingForm
        id={crypto.randomUUID()}
        projectId={projectId}
        action={saveBookingAction}
        back={back}
      />
    </FormPage>
  );
}
