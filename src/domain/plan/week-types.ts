import type {
  AgendaBooking,
  AgendaCalendarEvent,
  AgendaCommitment,
  AgendaProject,
  AgendaTask,
} from "@/domain/today/agenda-types";
import type { HouseholdProject } from "@/domain/projects/types";

export type WeekProject = AgendaProject &
  Pick<HouseholdProject, "starts_on" | "destination">;

export type WeekRoutinePriority =
  "pet_care" | "meal_deadline" | "cleaning" | "general";

export type WeekOccurrence = {
  id: string;
  due_date: string;
  planned_assignee_id: string | null;
  meal_plan_entry_id: string | null;
  routine: { title: string; priority: WeekRoutinePriority };
};

export type WeekCompletion = {
  completed_on: string;
  completed_at: string;
  completed_by_member_id: string;
  occurrence: WeekOccurrence;
};

export type HouseholdWeekInput = {
  weekStart: string;
  today: string;
  viewerUserId: string;
  members: Readonly<Record<string, string>>;
  projects: readonly WeekProject[];
  tasks: readonly AgendaTask[];
  bookings: readonly AgendaBooking[];
  commitments: readonly AgendaCommitment[];
  events: readonly AgendaCalendarEvent[];
  occurrences: readonly WeekOccurrence[];
  completions: readonly WeekCompletion[];
};

export type WeekPlanEntry = {
  id: string;
  kind: "calendar" | "booking" | "trip" | "task" | "project" | "commitment";
  title: string;
  /** Zurich start time on the first day of a timed item; null otherwise. */
  time: string | null;
  detail: string;
  href: string;
  /** The item began on an earlier day. */
  continues: boolean;
  related?: { href: string; label: string };
};

export type WeekRoutine = {
  occurrenceId: string;
  title: string;
  meta: string;
  tone: "overdue" | "open" | "completed";
  canComplete: boolean;
};

export type HouseholdWeekDay = {
  date: string;
  plans: WeekPlanEntry[];
  routines: WeekRoutine[];
};
