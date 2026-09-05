import { loadProjectActivity } from "@/lib/projects/activity";
import { ProjectHistory } from "@/ui/projects/project-history";
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
    historyPage?: string;
  }>;
}) {
  const { projectId } = await params;
  const search = await searchParams;
  const taskPage = /^\d{1,6}$/.test(search.taskPage ?? "")
    ? Number(search.taskPage)
    : 0;
  const historyPage = /^\d{1,6}$/.test(search.historyPage ?? "")
    ? Number(search.historyPage)
    : 0;
  const archivedTasks = search.archivedTasks === "1";
  const project = await loadProject(projectId);
  if (!project) notFound();
  const [work, history] = await Promise.all([
    loadProjectWork(projectId, taskPage, archivedTasks),
    loadProjectActivity(projectId, historyPage),
  ]);
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
      <ProjectHistory
        entries={history.entries}
        members={work.members}
        page={historyPage}
        hasMore={history.hasMore}
        href={(page) =>
          `/plan/projects/${projectId}?taskPage=${taskPage}&archivedTasks=${archivedTasks ? "1" : "0"}&historyPage=${page}#history`
        }
      />
      <ProjectArchive project={project} />
    </AppPage>
  );
}
