import "server-only";
import { requireMemberContext } from "@/lib/auth/member-context";
import { addStarterTasksAction } from "@/lib/projects/starter-action";
import { projectDetailSchemas } from "../definitions/project-detail-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
export const PROJECT_STARTER_HANDLERS: Record<string, AiWriteHandler> = {
  add_project_starter_tasks: async (input, { idempotencyKey }) => {
    const { projectId, preset, items } =
      projectDetailSchemas.add_project_starter_tasks.parse(input);
    const { householdId } = await requireMemberContext();
    const form = commandForm({
      projectId,
      preset,
      operationId: invocationRecordId(`${householdId}:${idempotencyKey}`),
    });
    for (const item of items) form.append("item", item);
    const result = await addStarterTasksAction(null, form);
    if (!result) throw new Error("Could not confirm the checklist additions.");
    if ("error" in result) throw new Error(result.error);
    return result;
  },
};
