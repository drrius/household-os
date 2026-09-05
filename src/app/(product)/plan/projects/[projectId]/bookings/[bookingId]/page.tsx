import { PlanResources } from "@/ui/projects/plan-resources";
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
  searchParams: Promise<{
    back?: string;
    documentPage?: string;
    archivedDocuments?: string;
  }>;
  params: Promise<{ projectId: string; bookingId: string }>;
}) {
  const { projectId, bookingId } = await params;
  const query = await searchParams;
  const back = bookingBack(projectId, query.back);
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
      <PlanResources
        projectId={projectId}
        bookingId={bookingId}
        archived={Boolean(project.archived_at || booking.archived_at)}
        query={query}
      />
    </AppPage>
  );
}
