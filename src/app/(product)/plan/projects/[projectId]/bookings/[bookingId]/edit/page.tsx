import { bookingBack } from "@/lib/trips/navigation";
import { notFound } from "next/navigation";
import { loadProject } from "@/lib/projects/queries";
import { loadBooking } from "@/lib/trips/queries";
import { FormPage } from "@/ui/forms/form-page";
import { BookingForm } from "@/ui/trips/booking-form.client";
import { saveBookingAction } from "../../actions";
export default async function EditBookingPage({
  params,
  searchParams,
}: {
  searchParams: Promise<{ back?: string }>;
  params: Promise<{ projectId: string; bookingId: string }>;
}) {
  const { projectId, bookingId } = await params;
  const back = bookingBack(projectId, (await searchParams).back);
  const [project, booking] = await Promise.all([
    loadProject(projectId),
    loadBooking(projectId, bookingId),
  ]);
  if (
    !project ||
    project.kind !== "trip" ||
    project.archived_at ||
    !booking ||
    booking.archived_at
  )
    notFound();
  return (
    <FormPage
      title="Edit booking"
      description={project.title}
      backHref={`/plan/projects/${projectId}/bookings/${bookingId}?back=${encodeURIComponent(back)}`}
    >
      <BookingForm
        id={bookingId}
        projectId={projectId}
        booking={booking}
        action={saveBookingAction}
        back={back}
      />
    </FormPage>
  );
}
