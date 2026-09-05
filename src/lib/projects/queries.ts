import "server-only";

import { z } from "zod";
import type {
  HouseholdProject,
  ProjectKind,
  ProjectMember,
  ProjectTask,
} from "@/domain/projects/types";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const projectFields =
  "id, kind, title, description, status, starts_on, ends_on, destination, budget_cents, archived_at, updated_at";
const taskFields =
  "id, project_id, title, section, assigned_member_id, due_on, completed_at, completed_by_member_id, notes, sort_order, archived_at, updated_at";

export async function loadProjects(
  kind: ProjectKind,
  archived: boolean,
  page: number,
) {
  const member = await requireMemberContext();
  const client = await createClient();
  let query = client
    .from("household_projects")
    .select(projectFields)
    .eq("household_id", member.householdId)
    .eq("kind", kind);
  query = archived
    ? query.not("archived_at", "is", null)
    : query.is("archived_at", null);
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .order("id")
    .range(page * 30, page * 30 + 30);
  if (error) throw new Error("Couldn't load your plans. Try again.");
  const rows = data as HouseholdProject[];
  return { projects: rows.slice(0, 30), hasMore: rows.length > 30 };
}

export async function loadProject(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const member = await requireMemberContext();
  const client = await createClient();
  const result = await client
    .from("household_projects")
    .select(projectFields)
    .eq("household_id", member.householdId)
    .eq("id", id)
    .maybeSingle();
  if (result.error) throw new Error("Couldn't load this plan.");
  return result.data as HouseholdProject | null;
}

export async function loadProjectWork(
  projectId: string,
  taskPage = 0,
  archivedTasks = false,
) {
  const member = await requireMemberContext();
  const client = await createClient();
  let taskQuery = client
    .from("project_tasks")
    .select(taskFields)
    .eq("household_id", member.householdId)
    .eq("project_id", projectId);
  taskQuery = archivedTasks
    ? taskQuery.not("archived_at", "is", null)
    : taskQuery.is("archived_at", null);
  const [tasks, members] = await Promise.all([
    taskQuery
      .order("completed_at", { ascending: true, nullsFirst: true })
      .order("sort_order")
      .order("created_at")
      .order("id")
      .range(taskPage * 50, taskPage * 50 + 50),
    client
      .from("household_members")
      .select("user_id, display_name")
      .eq("household_id", member.householdId)
      .order("joined_at"),
  ]);
  if (tasks.error || members.error)
    throw new Error("Couldn't load the details for this plan.");
  return {
    tasks: (tasks.data as ProjectTask[]).slice(0, 50),
    hasMoreTasks: tasks.data.length > 50,
    members: members.data as ProjectMember[],
  };
}

export async function loadProjectTask(projectId: string, taskId: string) {
  if (
    !z.uuid().safeParse(projectId).success ||
    !z.uuid().safeParse(taskId).success
  )
    return null;
  const member = await requireMemberContext();
  const client = await createClient();
  const { data, error } = await client
    .from("project_tasks")
    .select(taskFields)
    .eq("household_id", member.householdId)
    .eq("project_id", projectId)
    .eq("id", taskId)
    .maybeSingle();
  if (error) throw new Error("Couldn't load this task.");
  return data as ProjectTask | null;
}
