"use server";

import { revalidatePath } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { starterTaskIds } from "@/lib/projects/starter-identities";
import { starterTasks } from "@/domain/projects/starters";
import { loadProject } from "@/lib/projects/queries";
import { createClient } from "@/lib/supabase/server";

export type StarterResult =
  { added: number; skipped: number } | { error: string } | null;

export async function addStarterTasksAction(
  _previous: StarterResult,
  form: FormData,
): Promise<StarterResult> {
  try {
    const projectId = z.uuid().parse(form.get("projectId"));
    const project = await loadProject(projectId);
    if (!project || project.archived_at)
      return { error: "Restore this plan before adding tasks." };
    const preset = z.string().max(30).parse(form.get("preset"));
    const selected = z
      .array(z.string().max(30))
      .min(1)
      .max(20)
      .parse(form.getAll("item"));
    const ids = starterTaskIds(projectId, project.kind);
    const tasks = starterTasks(project.kind, preset, selected, ids);
    const client = await createClient();
    const { data, error } = await client.rpc("add_project_task_batch", {
      p_project_id: projectId,
      p_tasks: tasks,
    });
    if (error?.code === "55000")
      return { error: "Restore this plan before adding tasks." };
    if (error)
      return {
        error:
          "Couldn't confirm these tasks. Retry this selection or check the checklist; existing tasks won't be added twice.",
      };
    const result = z
      .object({
        added: z.number().int().min(0).max(20),
        skipped: z.number().int().min(0).max(20),
      })
      .parse(data);
    if (result.added + result.skipped !== tasks.length)
      throw new Error("Unexpected task count");
    revalidatePath(`/plan/projects/${projectId}`);
    revalidatePath("/plan");
    revalidatePath("/");
    return result;
  } catch (failure) {
    unstable_rethrow(failure);
    return {
      error:
        "Couldn't add this selection. Choose at least one task, or reload the checklist and try again.",
    };
  }
}
