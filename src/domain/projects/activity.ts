import type { ProjectMember } from "./types";

export const PROJECT_ACTIVITY_KINDS = [
  "project_record_changed",
  "project_task_assigned",
] as const;
const labels: Readonly<Record<string, string>> = {
  title: "Title",
  description: "Description",
  kind: "Type",
  status: "Status",
  starts_on: "Start date",
  ends_on: "End date",
  destination: "Destination",
  budget_cents: "Budget",
  archived_at: "Archived at",
  section: "Section",
  assigned_member_id: "Assigned to",
  due_on: "Due date",
  completed_at: "Completed at",
  completed_by_member_id: "Completed by",
  notes: "Notes",
  sort_order: "Position",
};
export type ProjectActivityPayload = {
  title?: unknown;
  operation?: unknown;
  before?: unknown;
  after?: unknown;
  changed_fields?: unknown;
};
function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
function display(
  value: unknown,
  field: string,
  members: readonly ProjectMember[],
): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (field === "assigned_member_id" || field === "completed_by_member_id")
    return (
      members.find((member) => member.user_id === value)?.display_name ??
      "Former member"
    );
  if (field === "budget_cents") {
    if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
      return "Unavailable";
    const cents = BigInt(value);
    return `CHF ${cents / 100n}.${String(cents % 100n).padStart(2, "0")}`;
  }
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "Unavailable";
}
export function projectActivityChanges(
  payload: ProjectActivityPayload,
  members: readonly ProjectMember[],
) {
  const before = record(payload.before);
  const after = record(payload.after);
  const fields = Array.isArray(payload.changed_fields)
    ? payload.changed_fields
    : [];
  return fields
    .filter(
      (field): field is string =>
        typeof field === "string" && Object.hasOwn(labels, field),
    )
    .map((field) => ({
      label: labels[field],
      before: display(before[field], field, members),
      after: display(after[field], field, members),
    }));
}
export function projectActivityTitle(payload: ProjectActivityPayload) {
  const operations = [
    "created",
    "updated",
    "archived",
    "restored",
    "completed",
    "reopened",
  ];
  const operation =
    typeof payload.operation === "string" &&
    operations.includes(payload.operation)
      ? payload.operation
      : "updated";
  return `${operation} ${typeof payload.title === "string" ? payload.title : "a plan"}`;
}
