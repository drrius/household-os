import { ConcurrentFormFixture } from "./concurrent-form.client";
import { notFound } from "next/navigation";
import type { FormActionState } from "@/lib/forms/action-state";
import { settleFormAction } from "@/lib/forms/action-state";
import { parseProjectForm } from "@/lib/projects/forms";
import { FormPage } from "@/ui/forms/form-page";
import { ProjectForm } from "@/ui/projects/project-form.client";
import { ProjectList } from "@/ui/projects/project-list";
import { TaskRow } from "@/ui/projects/project-tasks";
import { AppShell } from "@/ui/shell/app-shell";

const project = {
  id: "00000000-0000-4000-8000-000000000010",
  kind: "trip" as const,
  title: "A long weekend in Copenhagen",
  description: "Coffee, canals, and time together.",
  status: "planning" as const,
  starts_on: "2026-10-08",
  ends_on: "2026-10-12",
  destination: "Copenhagen, Denmark",
  budget_cents: 120000,
  archived_at: null,
  updated_at: "2026-09-05T00:00:00Z",
};

async function validateTrip(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1")
    throw new Error("Unavailable");
  return (await settleFormAction(previous, form, async () => {
    parseProjectForm(form);
    throw new Error("Connection interrupted. Your details are still here.");
  }))!;
}

async function rejectTask(previous: FormActionState): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1")
    throw new Error("Unavailable");
  return {
    submissionId: previous.submissionId + 1,
    error: "This task changed. Reload before trying again.",
  };
}

export default async function ProjectFixture({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { view } = await searchParams;
  return (
    <AppShell>
      {view === "concurrent-project" || view === "concurrent-task" ? (
        <FormPage
          title="Edit plan"
          description="Concurrent edit fixture"
          backHref="/plan"
        >
          <ConcurrentFormFixture
            project={project}
            taskMode={view === "concurrent-task"}
          />
        </FormPage>
      ) : view === "list" ? (
        <ProjectList
          kind="trip"
          projects={[project]}
          archived
          page={1}
          hasMore
        />
      ) : view === "task" ? (
        <FormPage
          title="Packing"
          description={project.title}
          backHref="/plan/trips"
        >
          <ul className="list-none divide-y">
            <TaskRow
              task={{
                id: "00000000-0000-4000-8000-000000000020",
                project_id: project.id,
                title: "Pack the chargers",
                section: "Packing",
                assigned_member_id: null,
                due_on: "2026-10-07",
                completed_at: null,
                completed_by_member_id: null,
                notes: "",
                sort_order: 0,
                archived_at: null,
                updated_at: project.updated_at,
              }}
              members={[]}
              archived={false}
              action={rejectTask}
            />
          </ul>
        </FormPage>
      ) : (
        <FormPage
          title="Plan a trip"
          description="Start with a name. You can decide the rest together."
          backHref="/plan/trips"
        >
          <ProjectForm id={project.id} kind="trip" action={validateTrip} />
        </FormPage>
      )}
    </AppShell>
  );
}
