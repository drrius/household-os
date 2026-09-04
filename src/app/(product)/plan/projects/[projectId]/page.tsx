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
  searchParams: Promise<{ taskPage?: string; archivedTasks?: string }>;
}) {
  const { projectId } = await params;
  const search = await searchParams;
  const taskPage = /^\d{1,6}$/.test(search.taskPage ?? "")
    ? Number(search.taskPage)
    : 0;
  const archivedTasks = search.archivedTasks === "1";
  const project = await loadProject(projectId);
  if (!project) notFound();
  const work = await loadProjectWork(projectId, taskPage, archivedTasks);
  return (
    <AppPage labelledBy="project-title">
      <ProjectOverview project={project} />
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
