"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  archiveHouseholdRecord,
  saveHouseholdRecord,
} from "@/lib/connected/records";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  parseProjectForm,
  parseTaskForm,
  recordId,
  recordVersion,
} from "@/lib/projects/forms";
import { loadProject, loadProjectTask } from "@/lib/projects/queries";

function refreshProject(id: string) {
  revalidatePath("/plan");
  revalidatePath("/plan/projects");
  revalidatePath("/plan/trips");
  revalidatePath(`/plan/projects/${id}`);
  revalidatePath("/");
}

export async function saveProjectAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const parsed = parseProjectForm(form);
    id = parsed.id;
    await saveHouseholdRecord(
      "household_projects",
      id,
      parsed.fields,
      parsed.version,
    );
  });
  if (rejected) return rejected;
  refreshProject(id);
  redirect(`/plan/projects/${id}`);
}

export async function archiveProjectAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    id = recordId(form.get("id"));
    const version = recordVersion(form);
    if (!version)
      throw new Error("Reload this plan before changing its archive status.");
    await archiveHouseholdRecord(
      "household_projects",
      id,
      version,
      form.get("archived") === "true",
    );
  });
  if (rejected) return rejected;
  refreshProject(id);
  redirect(`/plan/projects/${id}`);
}

export async function saveProjectTaskAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let projectId = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const parsed = parseTaskForm(form);
    projectId = parsed.fields.project_id;
    const project = await loadProject(projectId);
    if (!project || project.archived_at)
      throw new Error("Restore this plan before adding or editing tasks.");
    if (parsed.version) {
      const task = await loadProjectTask(projectId, parsed.id);
      if (!task || task.archived_at)
        throw new Error("Restore this task before editing it.");
    }
    await saveHouseholdRecord(
      "project_tasks",
      parsed.id,
      parsed.fields,
      parsed.version,
    );
  });
  if (rejected) return rejected;
  refreshProject(projectId);
  redirect(`/plan/projects/${projectId}#tasks`);
}

export async function setProjectTaskStateAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let projectId = "";
  const rejected = await settleFormAction(previous, form, async () => {
    const id = recordId(form.get("id"));
    projectId = recordId(form.get("project_id"));
    const version = recordVersion(form);
    if (!version) throw new Error("Reload this task before changing it.");
    const project = await loadProject(projectId);
    if (!project || project.archived_at)
      throw new Error("Restore this plan before changing tasks.");
    const task = await loadProjectTask(projectId, id);
    if (!task) throw new Error("This task is no longer available.");
    const operation = form.get("operation");
    if (!["archive", "restore", "complete"].includes(String(operation)))
      throw new Error("Choose a valid task action.");
    if (operation === "archive" || operation === "restore")
      await archiveHouseholdRecord(
        "project_tasks",
        id,
        version,
        operation === "archive",
      );
    else {
      if (task.archived_at)
        throw new Error("Restore this task before changing it.");
      if (form.get("completed") !== "true" && form.get("completed") !== "false")
        throw new Error("Choose whether this task is complete.");
      await saveHouseholdRecord(
        "project_tasks",
        id,
        {
          completed_at:
            form.get("completed") === "true" ? new Date().toISOString() : null,
        },
        version,
      );
    }
  });
  if (rejected) return rejected;
  refreshProject(projectId);
  if (
    form.get("operation") === "archive" ||
    form.get("operation") === "restore"
  )
    redirect(`/plan/projects/${projectId}#tasks`);
  return { submissionId: previous.submissionId + 1 };
}
