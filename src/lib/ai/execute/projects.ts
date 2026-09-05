import "server-only";
import { revalidatePath } from "next/cache";
import { projectToolSchemas as schemas } from "../definitions/project-tools";
import type { AiWriteHandler } from "./types";
import { commandForm, invocationRecordId } from "./connected-input";
import {
  archiveHouseholdRecord,
  saveHouseholdRecord,
} from "@/lib/connected/records";
import { loadProject, loadProjectTask } from "@/lib/projects/queries";
import { parseProjectForm, parseTaskForm } from "@/lib/projects/forms";
import { formatCentimesField } from "@/domain/money/chf";
import { requireMemberContext } from "@/lib/auth/member-context";

function refresh(id: string) {
  for (const path of [
    "/",
    "/plan",
    "/plan/projects",
    "/plan/trips",
    `/plan/projects/${id}`,
  ])
    revalidatePath(path);
}
async function activeProject(id: string) {
  const project = await loadProject(id);
  if (!project || project.archived_at)
    throw new Error("Restore this plan before changing it.");
  return project;
}
export const PROJECT_HANDLERS: Record<string, AiWriteHandler> = {
  save_project: async (input, context) => {
    const value = schemas.save_project.parse(input);
    const member = await requireMemberContext();
    const identity = value.identity;
    const id =
      identity.mode === "create"
        ? invocationRecordId(`${member.householdId}:${context.idempotencyKey}`)
        : identity.id;
    if (identity.mode === "update") await activeProject(id);
    const { budgetCents, ...fields } = value.fields;
    const parsed = parseProjectForm(
      commandForm({
        ...fields,
        id,
        updatedAt: identity.mode === "update" ? identity.updatedAt : null,
        budget: budgetCents === null ? "" : formatCentimesField(budgetCents),
      }),
    );
    await saveHouseholdRecord(
      "household_projects",
      id,
      parsed.fields,
      parsed.version,
    );
    refresh(id);
    return { id };
  },
  archive_project: async (input) => {
    const value = schemas.archive_project.parse(input);
    await archiveHouseholdRecord(
      "household_projects",
      value.id,
      value.updatedAt,
      value.archived,
    );
    refresh(value.id);
    return { id: value.id };
  },
  save_project_task: async (input, context) => {
    const value = schemas.save_project_task.parse(input);
    const member = await requireMemberContext();
    await activeProject(value.fields.project_id);
    const identity = value.identity;
    const id =
      identity.mode === "create"
        ? invocationRecordId(`${member.householdId}:${context.idempotencyKey}`)
        : identity.id;
    if (identity.mode === "update") {
      const task = await loadProjectTask(value.fields.project_id, id);
      if (!task || task.archived_at)
        throw new Error("Restore this task before editing it.");
    }
    const parsed = parseTaskForm(
      commandForm({
        ...value.fields,
        id,
        updatedAt: identity.mode === "update" ? identity.updatedAt : null,
      }),
    );
    await saveHouseholdRecord(
      "project_tasks",
      id,
      parsed.fields,
      parsed.version,
    );
    refresh(value.fields.project_id);
    return { id, projectId: value.fields.project_id };
  },
  set_project_task_state: async (input) => {
    const value = schemas.set_project_task_state.parse(input);
    await activeProject(value.projectId);
    const task = await loadProjectTask(value.projectId, value.id);
    if (!task) throw new Error("This task is no longer available.");
    if (value.operation === "archive" || value.operation === "restore") {
      await archiveHouseholdRecord(
        "project_tasks",
        value.id,
        value.updatedAt,
        value.operation === "archive",
      );
    } else {
      if (task.archived_at)
        throw new Error("Restore this task before changing it.");
      await saveHouseholdRecord(
        "project_tasks",
        value.id,
        {
          completed_at:
            value.operation === "complete" ? new Date().toISOString() : null,
        },
        value.updatedAt,
      );
    }
    refresh(value.projectId);
    return { id: value.id, projectId: value.projectId };
  },
};
