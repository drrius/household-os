import { bookingBack } from "@/lib/trips/navigation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadProject } from "@/lib/projects/queries";
import { loadBooking } from "@/lib/trips/queries";
import { BookingDetails } from "@/ui/trips/booking-details";
import { AppPage } from "@/ui/layout/app-page";
export default async function BookingPage({
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
  if (!project || project.kind !== "trip" || !booking) notFound();
  return (
    <AppPage labelledBy="booking-title">
      <Link
        href={back}
        className="min-h-11 w-fit content-center text-muted-foreground"
      >
        ← {project.title}
      </Link>
      <BookingDetails
        booking={booking}
        tripArchived={Boolean(project.archived_at)}
        back={back}
      />
    </AppPage>
  );
}
