"use client";

import { useState } from "react";
import type { HouseholdProject, ProjectTask } from "@/domain/projects/types";
import type { FormAction } from "@/lib/forms/action-state";
import { ProjectForm } from "@/ui/projects/project-form.client";
import { ProjectTaskForm } from "@/ui/projects/task-form.client";

export function ConcurrentFormFixture({
  project,
  taskMode,
}: {
  project: HouseholdProject;
  taskMode: boolean;
}) {
  const [incoming, setIncoming] = useState(project);
  const task: ProjectTask = {
    id: "00000000-0000-4000-8000-000000000020",
    project_id: incoming.id,
    title: incoming.title,
    section: "Packing",
    assigned_member_id: null,
    due_on: null,
    completed_at: null,
    completed_by_member_id: null,
    notes: incoming.description,
    sort_order: 0,
    archived_at: null,
    updated_at: incoming.updated_at,
  };
  const action: FormAction = async (previous, form) => ({
    submissionId: previous.submissionId + 1,
    values: Object.fromEntries(
      Array.from(form.entries()).filter(
        (entry): entry is [string, string] => typeof entry[1] === "string",
      ),
    ),
    error:
      form.get("updatedAt") === incoming.updated_at
        ? "Current snapshot accepted"
        : "This changed since you opened it. Reload before saving.",
  });
  return (
    <div className="grid gap-5">
      <button
        type="button"
        onClick={() =>
          setIncoming({
            ...incoming,
            title: "Partner's new title",
            updated_at: "2026-09-05T01:00:00Z",
          })
        }
      >
        Simulate partner refresh
      </button>
      {taskMode ? (
        <ProjectTaskForm
          id={task.id}
          projectId={project.id}
          task={task}
          members={[
            {
              user_id: "00000000-0000-4000-8000-000000000021",
              display_name: "Sam",
            },
          ]}
          action={action}
        />
      ) : (
        <ProjectForm
          id={project.id}
          kind={project.kind}
          project={incoming}
          action={action}
        />
      )}
    </div>
  );
}
