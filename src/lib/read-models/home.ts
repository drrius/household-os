import { z } from "zod";

import { ZURICH_TIME_ZONE } from "@/lib/ui/zurich-date";

const activityKindSchema = z.enum([
  "project_record_changed",
  "project_task_assigned",
  "routine_created",
  "routine_updated",
  "occurrence_completed",
  "occurrence_skipped",
  "occurrence_rescheduled",
  "routine_paused",
  "routine_unpaused",
  "routine_archived",
  "meal_plan_entry_created",
  "meal_plan_entry_updated",
  "meal_plan_entry_removed",
  "shopping_session_finished",
  "opening_balance_established",
  "expense_posted",
  "expense_draft_confirmed",
  "expense_draft_dismissed",
  "refund_posted",
  "settlement_recorded",
  "financial_event_corrected",
  "recurring_expense_rule_created",
  "recurring_expense_rule_updated",
  "recurring_drafts_generated",
]);
const timestampSchema = z.iso.datetime({ offset: true });
const householdRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});
const memberRowSchema = z.object({
  user_id: z.string().min(1),
  display_name: z.string().trim().min(1),
  joined_at: timestampSchema,
});
const petRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
});
const areaRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1),
  sort_order: z.number().int().nonnegative(),
});
const routineRowSchema = z.object({
  id: z.string().min(1),
  title: z.string().trim().min(1),
  area_id: z.string().min(1),
  pet_id: z.string().min(1).nullable(),
  archived_at: timestampSchema.nullable(),
});
const activityRowSchema = z.object({
  id: z.string().min(1),
  actor_member_id: z.string().min(1),
  kind: activityKindSchema,
  entity_type: z.string().min(1),
  entity_id: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  created_at: timestampSchema,
});

type HouseholdRow = z.infer<typeof householdRowSchema>;
type MemberRow = z.infer<typeof memberRowSchema>;
type PetRow = z.infer<typeof petRowSchema>;
type AreaRow = z.infer<typeof areaRowSchema>;
type RoutineRow = z.infer<typeof routineRowSchema>;
type ActivityRow = z.infer<typeof activityRowSchema>;
type ActivityKind = z.infer<typeof activityKindSchema>;

export type HomeViewModel = {
  householdLabel: string;
  members: Array<{ userId: string; displayName: string; isSelf: boolean }>;
  pets: Array<{ id: string; name: string; meta: string }>;
  areas: Array<{ id: string; name: string; routineCount: number }>;
  routines: Array<{ id: string; title: string; areaName: string }>;
  activity: Array<{ id: string; title: string; whenLabel: string }>;
  storageUsedLabel: string | null;
};

export type HomeReadRows = {
  households: readonly HouseholdRow[];
  members: readonly MemberRow[];
  pets: readonly PetRow[];
  areas: readonly AreaRow[];
  routines: readonly RoutineRow[];
  activityEvents: readonly ActivityRow[];
};

export type BuildHomeViewModelInput = HomeReadRows & {
  viewerId: string;
  storageUsedLabel?: string | null;
};

const ACTIVITY_COPY = {
  project_record_changed: ["updated a plan", null],
  project_task_assigned: ["assigned a project task", null],
  routine_created: ["created a routine", "created"],
  routine_updated: ["updated a routine", "updated"],
  occurrence_completed: ["completed a routine", "completed"],
  occurrence_skipped: ["skipped a routine", "skipped"],
  occurrence_rescheduled: ["rescheduled a routine", "rescheduled"],
  routine_paused: ["paused a routine", "paused"],
  routine_unpaused: ["resumed a routine", "resumed"],
  routine_archived: ["archived a routine", "archived"],
  meal_plan_entry_created: ["planned a meal", null],
  meal_plan_entry_updated: ["updated the meal plan", null],
  meal_plan_entry_removed: ["removed a meal", null],
  shopping_session_finished: ["finished a shopping trip", null],
  opening_balance_established: ["set the opening balance", null],
  expense_posted: ["posted an expense", null],
  expense_draft_confirmed: ["confirmed an expense draft", null],
  expense_draft_dismissed: ["dismissed an expense draft", null],
  refund_posted: ["posted a refund", null],
  settlement_recorded: ["recorded a settlement", null],
  financial_event_corrected: ["corrected a financial event", null],
  recurring_expense_rule_created: ["created a recurring expense", null],
  recurring_expense_rule_updated: ["updated a recurring expense", null],
  recurring_drafts_generated: ["generated recurring expense drafts", null],
} satisfies Record<ActivityKind, readonly [string, string | null]>;
const activityWhenFormatter = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: ZURICH_TIME_ZONE,
});

function countLabel(count: number): string {
  return `${count} ${count === 1 ? "routine" : "routines"}`;
}

function routineIdForActivity(row: ActivityRow): string | null {
  if (row.entity_type === "routine") {
    return row.entity_id;
  }

  const routineId = row.payload.routine_id;
  return typeof routineId === "string" && routineId.length > 0
    ? routineId
    : null;
}

function formatActivityWhen(timestamp: string): string {
  return activityWhenFormatter.format(new Date(timestamp));
}

function mapRoutines(
  routines: readonly RoutineRow[],
  areas: readonly AreaRow[],
): HomeViewModel["routines"] {
  const areaNameById = new Map(areas.map((area) => [area.id, area.name]));
  return routines
    .filter((routine) => routine.archived_at === null)
    .map((routine) => ({
      id: routine.id,
      title: routine.title,
      areaName: areaNameById.get(routine.area_id) ?? "Household",
    }))
    .sort(
      (left, right) =>
        left.areaName.localeCompare(right.areaName) ||
        left.title.localeCompare(right.title) ||
        left.id.localeCompare(right.id),
    );
}

function requireHousehold(input: BuildHomeViewModelInput): HouseholdRow {
  const household = input.households[0];
  if (input.households.length !== 1 || household === undefined) {
    throw new Error("Home requires exactly one household");
  }
  if (input.members.length !== 2) {
    throw new Error("Home requires exactly two household members");
  }
  if (!input.members.some((member) => member.user_id === input.viewerId)) {
    throw new Error("Home viewer must be a household member");
  }
  return household;
}

function mapActivity({
  events,
  memberNameById,
  routineById,
}: {
  events: readonly ActivityRow[];
  memberNameById: ReadonlyMap<string, string>;
  routineById: ReadonlyMap<string, RoutineRow>;
}): HomeViewModel["activity"] {
  return [...events]
    .sort(
      (left, right) =>
        Date.parse(right.created_at) - Date.parse(left.created_at) ||
        right.id.localeCompare(left.id),
    )
    .map((event) => {
      const actorName = memberNameById.get(event.actor_member_id);
      if (actorName === undefined) {
        throw new Error(`Unknown activity actor: ${event.actor_member_id}`);
      }
      const [fallback, routineVerb] = ACTIVITY_COPY[event.kind];
      const routineId = routineIdForActivity(event);
      const routineTitle =
        routineId === null ? undefined : routineById.get(routineId)?.title;
      const action =
        routineVerb !== null && routineTitle !== undefined
          ? `${routineVerb} ${routineTitle}`
          : fallback;

      return {
        id: event.id,
        title: `${actorName} ${action}`,
        whenLabel: formatActivityWhen(event.created_at),
      };
    });
}

export function buildHomeViewModel(
  input: BuildHomeViewModelInput,
): HomeViewModel {
  const household = requireHousehold(input);

  const members = [...input.members]
    .sort(
      (left, right) =>
        Date.parse(left.joined_at) - Date.parse(right.joined_at) ||
        left.user_id.localeCompare(right.user_id),
    )
    .map((member) => ({
      userId: member.user_id,
      displayName: member.display_name,
      isSelf: member.user_id === input.viewerId,
    }));
  const memberNameById = new Map(
    members.map((member) => [member.userId, member.displayName]),
  );
  const activeRoutines = input.routines.filter(
    (routine) => routine.archived_at === null,
  );
  const routineById = new Map(
    input.routines.map((routine) => [routine.id, routine]),
  );
  const routineCountByArea = new Map<string, number>();
  const routineCountByPet = new Map<string, number>();

  for (const routine of activeRoutines) {
    routineCountByArea.set(
      routine.area_id,
      (routineCountByArea.get(routine.area_id) ?? 0) + 1,
    );
    if (routine.pet_id !== null) {
      routineCountByPet.set(
        routine.pet_id,
        (routineCountByPet.get(routine.pet_id) ?? 0) + 1,
      );
    }
  }

  const pets = [...input.pets]
    .sort(
      (left, right) =>
        left.name.localeCompare(right.name) || left.id.localeCompare(right.id),
    )
    .map((pet) => ({
      id: pet.id,
      name: pet.name,
      meta: countLabel(routineCountByPet.get(pet.id) ?? 0),
    }));
  const areas = [...input.areas]
    .sort(
      (left, right) =>
        left.sort_order - right.sort_order ||
        left.name.localeCompare(right.name) ||
        left.id.localeCompare(right.id),
    )
    .map((area) => ({
      id: area.id,
      name: area.name,
      routineCount: routineCountByArea.get(area.id) ?? 0,
    }));
  const activity = mapActivity({
    events: input.activityEvents,
    memberNameById,
    routineById,
  });
  const storageUsedLabel = input.storageUsedLabel?.trim() || null;
  const routines = mapRoutines(activeRoutines, input.areas);

  return {
    householdLabel: household.name,
    members,
    pets,
    areas,
    routines,
    activity,
    storageUsedLabel,
  };
}

export function parseHomeReadRows(
  input: Record<keyof HomeReadRows, unknown>,
): HomeReadRows {
  return {
    households: z.array(householdRowSchema).parse(input.households),
    members: z.array(memberRowSchema).parse(input.members),
    pets: z.array(petRowSchema).parse(input.pets),
    areas: z.array(areaRowSchema).parse(input.areas),
    routines: z.array(routineRowSchema).parse(input.routines),
    activityEvents: z.array(activityRowSchema).parse(input.activityEvents),
  };
}
