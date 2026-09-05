import { TripItinerary } from "@/ui/trips/itinerary";
import { loadBookings } from "@/lib/trips/queries";
import { notFound } from "next/navigation";
import { loadProject, loadProjectWork } from "@/lib/projects/queries";
import { AppPage } from "@/ui/layout/app-page";
import {
  ProjectArchive,
  ProjectOverview,
} from "@/ui/projects/project-overview";
import { ProjectTasks } from "@/ui/projects/project-tasks";

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    taskPage?: string;
    archivedTasks?: string;
    bookingPage?: string;
    archivedBookings?: string;
  }>;
}) {
  const { projectId } = await params;
  const search = await searchParams;
  const taskPage = /^\d{1,6}$/.test(search.taskPage ?? "")
    ? Number(search.taskPage)
    : 0;
  const archivedTasks = search.archivedTasks === "1";
  const project = await loadProject(projectId);
  if (!project) notFound();
  const bookingPage = /^\d{1,6}$/.test(search.bookingPage ?? "")
    ? Number(search.bookingPage)
    : 0;
  const archivedBookings = search.archivedBookings === "1";
  const [work, itinerary] = await Promise.all([
    loadProjectWork(projectId, taskPage, archivedTasks),
    project.kind === "trip"
      ? loadBookings(projectId, bookingPage, archivedBookings)
      : Promise.resolve(null),
  ]);
  return (
    <AppPage labelledBy="project-title">
      <ProjectOverview project={project} />
      {itinerary ? (
        <TripItinerary
          projectId={projectId}
          bookings={itinerary.bookings}
          archived={Boolean(project.archived_at)}
          showArchived={archivedBookings}
          page={bookingPage}
          hasMore={itinerary.hasMore}
          taskPage={search.taskPage}
          archivedTasks={search.archivedTasks}
        />
      ) : null}
      <ProjectTasks
        projectId={projectId}
        tasks={work.tasks}
        members={work.members}
        archived={Boolean(project.archived_at)}
        archivedTasks={archivedTasks}
        page={taskPage}
        hasMore={work.hasMoreTasks}
      />
      <ProjectArchive project={project} />
    </AppPage>
  );
}
