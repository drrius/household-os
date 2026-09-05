import { z } from "zod";
import { isoDate, uuid, type AiToolDefinition } from "./schemas";
export const editVersion = z.iso.datetime({ offset: true });
const text = (max: number) => z.string().trim().max(max).default("");
const moneyEstimate = z
  .number()
  .int()
  .min(0)
  .max(2147483647)
  .nullable()
  .default(null);
export const recordIdentity = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create") }),
  z.object({ mode: z.literal("update"), id: uuid, updatedAt: editVersion }),
]);
const projectFields = z.object({
  kind: z.enum(["project", "trip"]),
  title: z.string().trim().min(1).max(160),
  description: text(8000),
  status: z
    .enum(["planning", "active", "complete", "cancelled"])
    .default("planning"),
  starts_on: isoDate.nullable().default(null),
  ends_on: isoDate.nullable().default(null),
  destination: text(300),
  budgetCents: moneyEstimate,
});
const taskFields = z.object({
  project_id: uuid,
  title: z.string().trim().min(1).max(200),
  section: z.string().trim().min(1).max(80).default("Tasks"),
  assigned_member_id: uuid.nullable().default(null),
  due_on: isoDate.nullable().default(null),
  notes: text(4000),
});
export const projectToolSchemas = {
  save_project: z.object({ identity: recordIdentity, fields: projectFields }),
  archive_project: z.object({
    id: uuid,
    updatedAt: editVersion,
    archived: z.boolean(),
  }),
  save_project_task: z.object({ identity: recordIdentity, fields: taskFields }),
  set_project_task_state: z.object({
    projectId: uuid,
    id: uuid,
    updatedAt: editVersion,
    operation: z.enum(["complete", "reopen", "archive", "restore"]),
  }),
};
const descriptions = {
  save_project:
    "Create or replace the editable details of a shared project/trip. For updates first read the record and preserve unchanged fields; supply its updated_at version. Creates use a stable tool-call identity. Budget is an estimate in integer CHF centimes and never posts money.",
  archive_project:
    "Archive or restore a plan using its last-read updated_at version. Keeps its tasks, bookings and financial history; archive is not deletion.",
  save_project_task:
    "Create or replace a plan task's editable details, assignment and due date. Read before updating and preserve unchanged fields. Requires an active parent and a current updated_at version for edits.",
  set_project_task_state:
    "Complete, reopen, archive or restore a project task using its last-read version. Completion records the authenticated member and never changes money.",
};
export const PROJECT_TOOLS: readonly AiToolDefinition[] = Object.entries(
  projectToolSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: "write",
  description: descriptions[name as keyof typeof descriptions],
}));
