import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import type { ProjectMember, ProjectTask } from "@/domain/projects/types";
import type { FormAction } from "@/lib/forms/action-state";
import { setProjectTaskStateAction } from "@/app/(product)/plan/projects/actions";
import { RecordAction } from "@/ui/projects/record-action.client";

export function TaskRow({
  task,
  members,
  archived,
  action = setProjectTaskStateAction,
}: {
  task: ProjectTask;
  members: ProjectMember[];
  archived: boolean;
  action?: FormAction;
}) {
  const assignee =
    members.find((member) => member.user_id === task.assigned_member_id)
      ?.display_name ?? "Either of us";
  return (
    <li className="flex flex-wrap items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <Link
          href={`/plan/projects/${task.project_id}/tasks/${task.id}`}
          className={`font-medium underline-offset-4 hover:underline ${task.completed_at ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </Link>
        <p className="mt-1 text-sm text-muted-foreground">
          {assignee}
          {task.due_on ? ` · ${task.due_on}` : ""}
        </p>
      </div>
      {!archived && (
        <RecordAction
          action={action}
          fields={{
            id: task.id,
            project_id: task.project_id,
            updatedAt: task.updated_at,
            completed: String(!task.completed_at),
            operation: task.archived_at ? "restore" : "complete",
          }}
          label={
            task.archived_at ? "Restore" : task.completed_at ? "Reopen" : "Done"
          }
        />
      )}
      {archived && task.completed_at && (
        <Check aria-label="Completed" className="size-5" />
      )}
    </li>
  );
}

export function ProjectTasks({
  projectId,
  tasks,
  members,
  archived,
  archivedTasks = false,
  page = 0,
  hasMore = false,
}: {
  projectId: string;
  tasks: ProjectTask[];
  members: ProjectMember[];
  archived: boolean;
  archivedTasks?: boolean;
  page?: number;
  hasMore?: boolean;
}) {
  const open = tasks.filter((task) => !task.completed_at);
  const completed = tasks.filter((task) => task.completed_at);
  return (
    <section
      id="tasks"
      aria-labelledby="project-tasks-title"
      className="rounded-2xl border bg-card p-5"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 id="project-tasks-title" className="text-lg font-semibold">
            {archivedTasks ? "Removed tasks" : "Checklists"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {open.length} to do · {completed.length} done on this page
          </p>
        </div>
        {!archived && !archivedTasks && (
          <Link
            href={`/plan/projects/${projectId}/tasks/new`}
            className={buttonVariants({ variant: "outline" })}
          >
            <Plus />
            Add task
          </Link>
        )}
      </div>
      {!archived && !archivedTasks && (
        <Link
          href={`/plan/projects/${projectId}/tasks/starters`}
          className="mt-3 inline-flex min-h-11 items-center text-sm underline underline-offset-4"
        >
          Choose a starter checklist
        </Link>
      )}
      {tasks.length === 0 && (
        <p className="py-6 text-sm text-muted-foreground">
          Start with the next thing to do. Use checklists for packing, bookings,
          and getting home ready.
        </p>
      )}
      <TaskGroups tasks={open} members={members} archived={archived} />
      <CompletedProjectTasks
        completed={completed}
        members={members}
        archived={archived}
      />
      <TaskPages
        projectId={projectId}
        page={page}
        hasMore={hasMore}
        archivedTasks={archivedTasks}
      />
    </section>
  );
}

function TaskPages({
  projectId,
  page,
  hasMore,
  archivedTasks,
}: {
  projectId: string;
  page: number;
  hasMore: boolean;
  archivedTasks: boolean;
}) {
  const path = `/plan/projects/${projectId}`;
  const suffix = archivedTasks ? "&archivedTasks=1" : "";
  return (
    <nav
      aria-label="Checklist pages"
      className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4 text-sm"
    >
      {page > 0 && (
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`${path}?taskPage=${page - 1}${suffix}#tasks`}
        >
          Previous tasks
        </Link>
      )}
      {hasMore && (
        <Link
          className={buttonVariants({ variant: "outline" })}
          href={`${path}?taskPage=${page + 1}${suffix}#tasks`}
        >
          More tasks
        </Link>
      )}
      <Link
        className="ml-auto inline-flex min-h-11 items-center underline underline-offset-4"
        href={`${path}${archivedTasks ? "" : "?archivedTasks=1"}#tasks`}
      >
        {archivedTasks ? "Current tasks" : "Removed tasks"}
      </Link>
    </nav>
  );
}

function CompletedProjectTasks({
  completed,
  members,
  archived,
}: {
  completed: ProjectTask[];
  members: ProjectMember[];
  archived: boolean;
}) {
  return (
    <>
      {completed.length > 0 && (
        <details className="mt-4 border-t pt-3">
          <summary className="cursor-pointer py-2 text-sm text-muted-foreground">
            Completed ({completed.length})
          </summary>
          <ul className="list-none divide-y">
            {completed.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                members={members}
                archived={archived}
              />
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

function TaskGroups({
  tasks,
  members,
  archived,
}: {
  tasks: ProjectTask[];
  members: ProjectMember[];
  archived: boolean;
}) {
  const sections = [...new Set(tasks.map((task) => task.section))];
  return sections.map((section) => (
    <div key={section} className="mt-5">
      <h3 className="text-sm font-semibold text-muted-foreground">{section}</h3>
      <ul className="list-none divide-y">
        {tasks
          .filter((task) => task.section === section)
          .map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              members={members}
              archived={archived}
            />
          ))}
      </ul>
    </div>
  ));
}
