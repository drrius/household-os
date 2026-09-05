import { z } from "zod";
import { uuid, type AiToolDefinition } from "./schemas";
import { pageIndex } from "./connected-read-tools";
export const projectDetailSchemas = {
  get_project_task: z.object({ projectId: uuid, taskId: uuid }),
  get_project_activity: z.object({ projectId: uuid, page: pageIndex }),
  get_project_starters: z.object({ kind: z.enum(["project", "trip"]) }),
  add_project_starter_tasks: z.object({
    projectId: uuid,
    preset: z.string().min(1).max(30),
    items: z.array(z.string().min(1).max(30)).min(1).max(20),
  }),
};
const descriptions = {
  get_project_task:
    "Read a task in its parent plan, including its exact update version and archived/completed state.",
  get_project_activity:
    "Read paginated activity for one trip or project. Page is zero-based.",
  get_project_starters:
    "List available project or trip starter checklists with preset and item keys. Use returned keys to add a chosen selection.",
  add_project_starter_tasks:
    "Add selected starter checklist items to an active plan. Use preset and item keys from get_project_starters. Retries of this call deduplicate the additions.",
};
export const PROJECT_DETAIL_TOOLS: readonly AiToolDefinition[] = Object.entries(
  projectDetailSchemas,
).map(([name, inputSchema]) => ({
  name,
  inputSchema,
  kind: name === "add_project_starter_tasks" ? "write" : "read",
  description: descriptions[name as keyof typeof descriptions],
}));
