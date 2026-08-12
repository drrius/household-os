import "server-only";

import { z } from "zod";

import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import {
  addCivilDays,
  zurichCivilDate,
  ZURICH_TIME_ZONE,
} from "@/lib/ui/zurich-date";

const activityKindSchema = z.enum([
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
const entityTypeSchema = z.enum([
  "routine",
  "routine_occurrence",
  "meal_plan_entry",
  "shopping_session",
  "financial_event",
  "expense_draft",
  "recurring_expense_rule",
  "expense_category",
]);
const timestampSchema = z
  .string()
  .min(1)
  .refine((value) => Number.isFinite(Date.parse(value)), "Expected timestamp");
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
  entity_type: entityTypeSchema,
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
  now: Date;
  storageUsedLabel?: string | null;
};

type ActivityCopy = {
  fallback: string;
  routineVerb: string | null;
};

const ACTIVITY_LIMIT = 10;
const ACTIVITY_COPY: Record<ActivityKind, ActivityCopy> = {
  routine_created: { fallback: "created a routine", routineVerb: "created" },
  routine_updated: { fallback: "updated a routine", routineVerb: "updated" },
  occurrence_completed: {
    fallback: "completed a routine",
    routineVerb: "completed",
  },
  occurrence_skipped: {
    fallback: "skipped a routine",
    routineVerb: "skipped",
  },
  occurrence_rescheduled: {
    fallback: "rescheduled a routine",
    routineVerb: "rescheduled",
  },
  routine_paused: { fallback: "paused a routine", routineVerb: "paused" },
  routine_unpaused: {
    fallback: "resumed a routine",
    routineVerb: "resumed",
  },
  routine_archived: {
    fallback: "archived a routine",
    routineVerb: "archived",
  },
  meal_plan_entry_created: {
    fallback: "planned a meal",
    routineVerb: null,
  },
  meal_plan_entry_updated: {
    fallback: "updated the meal plan",
    routineVerb: null,
  },
  meal_plan_entry_removed: {
    fallback: "removed a meal",
    routineVerb: null,
  },
  shopping_session_finished: {
    fallback: "finished a shopping trip",
    routineVerb: null,
  },
  opening_balance_established: {
    fallback: "set the opening balance",
    routineVerb: null,
  },
  expense_posted: { fallback: "posted an expense", routineVerb: null },
  expense_draft_confirmed: {
    fallback: "confirmed an expense draft",
    routineVerb: null,
  },
  expense_draft_dismissed: {
    fallback: "dismissed an expense draft",
    routineVerb: null,
  },
  refund_posted: { fallback: "posted a refund", routineVerb: null },
  settlement_recorded: {
    fallback: "recorded a settlement",
    routineVerb: null,
  },
  financial_event_corrected: {
    fallback: "corrected a financial event",
    routineVerb: null,
  },
  recurring_expense_rule_created: {
    fallback: "created a recurring expense",
    routineVerb: null,
  },
  recurring_expense_rule_updated: {
    fallback: "updated a recurring expense",
    routineVerb: null,
  },
  recurring_drafts_generated: {
    fallback: "generated recurring expense drafts",
    routineVerb: null,
  },
};
const activityTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: ZURICH_TIME_ZONE,
});
const activityDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
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

function formatActivityWhen(timestamp: string, now: Date): string {
  const date = new Date(timestamp);
  const eventDate = zurichCivilDate(date);
  const today = zurichCivilDate(now);
  const time = activityTimeFormatter.format(date);

  if (eventDate === today) {
    return `Today · ${time}`;
  }
  if (eventDate === addCivilDays(today, -1)) {
    return `Yesterday · ${time}`;
  }
  return `${activityDateFormatter.format(date)} · ${time}`;
}

export function buildHomeViewModel(
  input: BuildHomeViewModelInput,
): HomeViewModel {
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
  if (!Number.isFinite(input.now.valueOf())) {
    throw new Error("Home requires a valid current time");
  }

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
  const activity = [...input.activityEvents]
    .sort(
      (left, right) =>
        Date.parse(right.created_at) - Date.parse(left.created_at) ||
        right.id.localeCompare(left.id),
    )
    .slice(0, ACTIVITY_LIMIT)
    .map((event) => {
      const actorName = memberNameById.get(event.actor_member_id);
      if (actorName === undefined) {
        throw new Error(`Unknown activity actor: ${event.actor_member_id}`);
      }

      const copy = ACTIVITY_COPY[event.kind];
      const routineId = routineIdForActivity(event);
      const routineTitle =
        routineId === null ? undefined : routineById.get(routineId)?.title;
      const action =
        copy.routineVerb !== null && routineTitle !== undefined
          ? `${copy.routineVerb} ${routineTitle}`
          : copy.fallback;

      return {
        id: event.id,
        title: `${actorName} ${action}`,
        whenLabel: formatActivityWhen(event.created_at, input.now),
      };
    });
  const storageUsedLabel = input.storageUsedLabel?.trim() || null;

  return {
    householdLabel: household.name,
    members,
    pets,
    areas,
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

export async function loadHomeViewModel(): Promise<HomeViewModel> {
  const member = await requireMemberContext();
  const supabase = await createClient();
  const [households, members, pets, areas, routines, activityEvents] =
    await Promise.all([
      supabase
        .from("households")
        .select("id, name")
        .eq("id", member.householdId),
      supabase
        .from("household_members")
        .select("user_id, display_name, joined_at")
        .eq("household_id", member.householdId)
        .order("joined_at")
        .order("user_id"),
      supabase
        .from("pets")
        .select("id, name")
        .eq("household_id", member.householdId)
        .is("archived_at", null)
        .order("name")
        .order("id"),
      supabase
        .from("areas")
        .select("id, name, sort_order")
        .eq("household_id", member.householdId)
        .is("archived_at", null)
        .order("sort_order")
        .order("name"),
      supabase
        .from("routines")
        .select("id, title, area_id, pet_id, archived_at")
        .eq("household_id", member.householdId),
      supabase
        .from("activity_events")
        .select(
          "id, actor_member_id, kind, entity_type, entity_id, payload, created_at",
        )
        .eq("household_id", member.householdId)
        .order("created_at", { ascending: false })
        .limit(ACTIVITY_LIMIT),
    ]);
  const failures: Array<readonly [string, { message: string } | null]> = [
    ["household", households.error],
    ["members", members.error],
    ["pets", pets.error],
    ["areas", areas.error],
    ["routines", routines.error],
    ["activity", activityEvents.error],
  ];

  for (const [label, error] of failures) {
    if (error !== null) {
      throw new Error(`Home ${label} query failed: ${error.message}`);
    }
  }

  const rows = parseHomeReadRows({
    households: households.data,
    members: members.data,
    pets: pets.data,
    areas: areas.data,
    routines: routines.data,
    activityEvents: activityEvents.data,
  });

  return buildHomeViewModel({
    viewerId: member.userId,
    now: new Date(),
    storageUsedLabel: null,
    ...rows,
  });
}
